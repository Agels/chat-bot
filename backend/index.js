import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';

const app = express();
const upload = multer();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const GEMINI_MODEL = process.env.GEMINI_MODEL;

const SYSTEM_INSTRUCTION = `You are a personal finance assistant for the general public. Talk like a patient friend who is good with money, not like a bank or a trading app.

- Reply in the language the user writes in, and use the currency they mention. If an amount matters and they have not named a currency, ask.
- Use plain words. When a finance term is needed, explain it in the same sentence.
- Stay calm about money: no urgency, no fear, no hype about returns.
- Never invent numbers, interest rates, prices, or statistics. Work only with figures the user gives you, and say so when you would need a figure you do not have.
- You give general information and are not a licensed financial adviser. Do not tell the user which specific stock, fund, or crypto to buy. For big decisions such as loans, investments, tax, or insurance, suggest they check with a licensed professional.
- If the question is not about money, say briefly that you only help with personal finance.
- Keep answers short. Use simple Markdown only: paragraphs, bullet or numbered lists, and bold. No tables or code blocks.
- When you list amounts, put each one on its own line as "Label: amount", for example "Rent: Rp 1.500.000".
- The user may attach a photo or PDF, such as a receipt, a bill, or a bank statement. Read the amounts from it exactly as written. If part of it is unreadable, say which part instead of guessing.

You keep a money notebook for the user. Its current contents are given below under "Notebook". Use it when you answer, so the user never has to repeat their income, goal, or past spending.

- When the user reports spending in their latest message, or spending appears in the file attached to that message, write it in the notebook. Never write an expense that is already in the notebook, and never write one from an earlier message.
- For a receipt, write one expense per line item. If the items cannot be read, write one expense for the total. Never write both the items and the total.
- When the user states their currency, monthly income, what they are saving for, how much they want to save, how much they have already saved, how much they put aside each month, or a monthly spending limit for a category, write it in the notebook.
- To write in the notebook, end your answer with a block in exactly this form, one item per line, and only the lines that apply:

[notebook]
expense | YYYY-MM-DD | short label | amount | category
currency | Rp
income | amount
goal | name of the goal | amount
saved | amount
saving | amount the user puts aside each month
budget | category | monthly limit for that category
[/notebook]

- In the block, write amounts as digits only, with a dot for decimals and no thousands separators or currency, for example 1500000 or 12.50. Use the date on the receipt, or today's date when none is given. The category is one of: Food, Transport, Housing, Bills, Shopping, Health, Fun, Other.
- Leave the block out when there is nothing new to write.
- When you write in the notebook, say so in one short sentence. Do not list the items in your answer, because the app shows them under it.
- The totals under "Notebook" were calculated by the app. Use them as they are and do not add up the entries yourself.`;

const CATEGORIES = ['Food', 'Transport', 'Housing', 'Bills', 'Shopping', 'Health', 'Fun', 'Other'];

const isDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const isAmount = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

function toAmount(value) {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return NaN;
    let digits = value.replace(/[^\d.,]/g, '');
    // "5.000.000" atau "5,000,000": titik dan koma di sini pemisah ribuan
    if (/^\d{1,3}([.,]\d{3})+$/.test(digits)) digits = digits.replace(/[.,]/g, '');
    return digits ? Number(digits.replace(/,/g, '')) : NaN;
}

// Total dihitung di sini, bukan oleh model, supaya angkanya pasti benar
function describeNotebook(notebook, today) {
    const profile = notebook?.profile ?? {};
    const entries = (Array.isArray(notebook?.entries) ? notebook.entries : [])
        .filter((entry) => isDate(entry?.date) && isAmount(entry?.amount));
    const month = today.slice(0, 7);
    const byCategory = {};
    let spent = 0;
    for (const entry of entries) {
        if (!entry.date.startsWith(month)) continue;
        spent += entry.amount;
        byCategory[entry.category] = (byCategory[entry.category] ?? 0) + entry.amount;
    }

    // Sama dengan angka di halaman Home: sisa rencana bulan ini dibagi hari yang tersisa (termasuk hari ini)
    const [year, monthNumber, day] = today.split('-').map(Number);
    const daysLeft = new Date(year, monthNumber, 0).getDate() - day + 1;
    const saving = isAmount(profile.monthlySaving) ? profile.monthlySaving : 0;
    const left = isAmount(profile.monthlyIncome) ? profile.monthlyIncome - saving - spent : null;

    return [
        'Notebook',
        `Today: ${today}`,
        `Profile: ${JSON.stringify(profile)}`,
        `Budgets per month by category: ${JSON.stringify(notebook?.budgets ?? {})}`,
        `Spent this month (${month}): ${spent}`,
        `Spent this month by category: ${JSON.stringify(byCategory)}`,
        left === null
            ? 'Monthly income: not known yet'
            : `Left this month after planned saving: ${left}. Days left in the month, counting today: ${daysLeft}. Safe to spend per day: ${Math.floor(left / daysLeft)}`,
        `Entries (most recent 100 of ${entries.length}): ${JSON.stringify(entries.slice(-100).map(({ date, label, amount, category }) => ({ date, label, amount, category })))}`
    ].join('\n');
}

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// Memisahkan jawaban dari blok [notebook] yang ditulis model di akhir jawabannya
function readAnswer(text, today) {
    const block = text.match(/\[notebook\]([\s\S]*?)(?:\[\/notebook\]|$)/i);
    const reply = (block ? text.slice(0, block.index) + text.slice(block.index + block[0].length) : text).trim();
    const entries = [];
    const profile = {};
    const budgets = {};

    for (const line of block ? block[1].split('\n') : []) {
        const [kind, ...fields] = line.split('|').map((field) => field.trim());
        if (kind === 'expense' && fields.length >= 4) {
            const [date, label, amount, category] = fields;
            const entry = {
                date: isDate(date) ? date : today,
                label: capitalize(label.slice(0, 80)),
                amount: toAmount(amount),
                category: CATEGORIES.includes(category) ? category : 'Other'
            };
            if (entry.label && isAmount(entry.amount) && entry.amount > 0) entries.push(entry);
        } else if (kind === 'currency' && fields[0]) {
            profile.currency = fields[0].slice(0, 8);
        } else if (kind === 'income' && isAmount(toAmount(fields[0]))) {
            profile.monthlyIncome = toAmount(fields[0]);
        } else if (kind === 'goal' && fields[0] && isAmount(toAmount(fields[1]))) {
            profile.goalName = capitalize(fields[0].slice(0, 40));
            profile.goalAmount = toAmount(fields[1]);
        } else if (kind === 'saved' && isAmount(toAmount(fields[0]))) {
            profile.goalSaved = toAmount(fields[0]);
        } else if (kind === 'saving' && isAmount(toAmount(fields[0]))) {
            profile.monthlySaving = toAmount(fields[0]);
        } else if (kind === 'budget' && CATEGORIES.includes(fields[0]) && isAmount(toAmount(fields[1]))) {
            budgets[fields[0]] = toAmount(fields[1]);
        }
    }

    return { reply, entries, profile, budgets };
}

app.use(cors())
// Lampiran dikirim sebagai base64 di dalam JSON, jadi batas bawaan 100kb terlalu kecil
app.use(express.json({ limit: '20mb' }));

app.use(express.static(path.join(import.meta.dirname, '../frontend')));

app.post('/generate-text', async (req, res) => {
    try {
        const { prompt } = req.body

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt
        })
        res.status(200).json({ result: response.text })
    } catch (error) {
        res.status(500).json({ message: error.mesage })
    }
})

app.post('/generate-fr-image', upload.single('image'), async (req, res) => {
    try {
        const { prompt } = req.body
        const base64Image = req.file.buffer.toString('base64')

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [
                { text: prompt, type: 'text' },
                { inlineData: { data: base64Image, mimeType: req.file.mimetype } }
            ]
        })
        res.status(200).json({ result: response.text })
    } catch (error) {
        res.status(500).json({ message: error.mesage })

    }
})

app.post('/generate-fr-document', upload.single('document'), async (req, res) => {
    try {
        const { prompt } = req.body
        const base64Document = req.file.buffer.toString('base64')

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [
                { text: prompt, type: 'text' },
                { inlineData: { data: base64Document, mimeType: req.file.mimetype } }
            ]
        })
        res.status(200).json({ result: response.text })
    } catch (error) {
        res.status(500).json({ message: error.mesage })

    }
})

app.post('/generate-fr-audio', upload.single('audio'), async (req, res) => {
    try {
        const { prompt } = req.body
        const base64Audio = req.file.buffer.toString('base64')

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [
                { text: prompt, type: 'text' },
                { inlineData: { data: base64Audio, mimeType: req.file.mimetype } }
            ]
        })
        res.status(200).json({ result: response.text })
    } catch (error) {
        res.status(500).json({ message: error.mesage })

    }
})

app.post('/api/chat', async (req, res) => {
    const { conversation, notebook } = req.body;
    try {
        if (!Array.isArray(conversation)) throw new Error('Messages must be an array!');
        const today = isDate(req.body.today) ? req.body.today : new Date().toISOString().slice(0, 10);

        const contents = conversation.map(({ role, text, file }) => ({
            role,
            parts: file
                ? [{ text }, { inlineData: { data: file.data, mimeType: file.mimeType } }]
                : [{ text }]
        }));

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents,
            config: {
                temperature: 0.4,
                maxOutputTokens: 4096,
                // Tanpa batas waktu, permintaan yang macet membuat user menunggu tanpa akhir
                httpOptions: { timeout: 60000 },
                systemInstruction: `${SYSTEM_INSTRUCTION}\n\n${describeNotebook(notebook, today)}`
            },
        });

        const answer = readAnswer(response.text ?? '', today);
        if (!answer.reply) throw new Error('Reply was empty');

        res.status(200).json({ result: answer.reply, entries: answer.entries, profile: answer.profile, budgets: answer.budgets });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
const PORT = 3000;
app.listen(PORT, () => console.log(`Server ready on http://localhost:${PORT}`));