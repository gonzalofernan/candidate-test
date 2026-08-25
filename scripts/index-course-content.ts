import axios from 'axios';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { PDFParse } from 'pdf-parse';

dotenv.config();

const CourseSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    thumbnail: String,
    totalLessons: Number,
    category: String,
    tags: [String],
    durationMinutes: Number,
  },
  { timestamps: true }
);

const Course = mongoose.model('Course', CourseSchema);

const COURSE_FILE_MAP = [
  {
    title: 'Introducción a JavaScript',
    filename: 'javascript-fundamentals.pdf',
  },
  {
    title: 'React desde Cero',
    filename: 'react-hooks.pdf',
  },
  {
    title: 'Node.js y Express',
    filename: 'nodejs-express.pdf',
  },
  {
    title: 'MongoDB Esencial',
    filename: 'mongodb-fundamentals.pdf',
  },
  {
    title: 'TypeScript Profesional',
    filename: 'typescript-profesional.pdf',
  },
];

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/candidate-test';
  const apiBaseUrl = `http://localhost:${process.env.PORT || 3333}`;
  const coursesDir = path.join(process.cwd(), 'data', 'courses');

  console.log('[DB] Conectando a MongoDB...');
  await mongoose.connect(mongoUri);

  try {
    for (const courseEntry of COURSE_FILE_MAP) {
      const course = await Course.findOne({ title: courseEntry.title }).lean();

      if (!course) {
        throw new Error(`No se encontró el curso "${courseEntry.title}" en MongoDB`);
      }

      const pdfPath = path.join(coursesDir, courseEntry.filename);
      if (!fs.existsSync(pdfPath)) {
        throw new Error(`No se encontró el PDF ${pdfPath}`);
      }

      console.log(`[INDEX] Extrayendo texto de ${courseEntry.filename}...`);
      const fileBuffer = fs.readFileSync(pdfPath);
      const parser = new PDFParse({ data: fileBuffer });
      const parsedPdf = await parser.getText();
      await parser.destroy();

      // El endpoint sigue siendo la puerta de entrada para la indexación,
      // así validamos el flujo real de la aplicación y no una vía paralela.
      const response = await axios.post(`${apiBaseUrl}/api/knowledge/index`, {
        courseId: course._id.toString(),
        content: parsedPdf.text,
        sourceFile: courseEntry.filename,
      });

      console.log(
        `[OK] ${courseEntry.title}: ${response.data.chunksCreated} chunks indexados`
      );
    }
  } finally {
    await mongoose.disconnect();
    console.log('[DB] Conexion cerrada');
  }
}

main().catch((error) => {
  console.error('[ERROR] Error indexando contenido de cursos:', error);
  process.exit(1);
});
