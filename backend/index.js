import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';

const app = express();
const upload = multer();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const GEMINI_MODEL = process.env.GEMINI_MODEL;

app.use(express.json());

app.get('/', async(req, res) => {
    res.send('ok')
})

app.post('/generate-text', async(req, res) => {
    try {
        const { prompt } = req.body

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt
        })
        res.status(200).json({result: response.text})
    } catch (error) {
        res.status(500).json({ message: error.mesage})
    }
})

app.post('/generate-fr-image', upload.single('image'), async(req, res) => {
    try {
        const { prompt } = req.body
        const base64Image = req.file.buffer.toString('base64')
        
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [
                { text: prompt, type: 'text'},
                { inlineData: { data: base64Image, mimeType: req.file.mimetype }}
            ]
        })
        res.status(200).json({result: response.text})
    } catch (error) {
     res.status(500).json({ message: error.mesage})

    }
})

app.post('/generate-fr-document', upload.single('document'), async(req, res) => {
    try {
        const { prompt } = req.body
        const base64Document= req.file.buffer.toString('base64')
        
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [
                { text: prompt, type: 'text'},
                { inlineData: { data: base64Document, mimeType: req.file.mimetype }}
            ]
        })
        res.status(200).json({result: response.text})
    } catch (error) {
     res.status(500).json({ message: error.mesage})

    }
})

app.post('/generate-fr-audio', upload.single('audio'), async(req, res) => {
    try {
        const { prompt } = req.body
        const base64Audio = req.file.buffer.toString('base64')
        
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [
                { text: prompt, type: 'text'},
                { inlineData: { data: base64Audio, mimeType: req.file.mimetype }}
            ]
        })
        res.status(200).json({result: response.text})
    } catch (error) {
     res.status(500).json({ message: error.mesage})

    }
})

const PORT = 3000;
app.listen(PORT, () => console.log(`Server ready on http://localhost:${PORT}`));