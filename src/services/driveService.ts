import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import { Buffer } from 'buffer';
// Cargar variables de entorno si se ejecuta localmente
dotenv.config();
// Configuración desde variables de entorno
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN!;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!;
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID!;
// Validación de configuración
if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI || !REFRESH_TOKEN || !FOLDER_ID) {
    console.error("ERROR: Faltan variables de entorno requeridas (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_DRIVE_FOLDER_ID)");
}
/**
 * Crea e inicializa el cliente OAuth2 con el Refresh Token.
 * La librería googleapis maneja automáticamente el intercambio de refresh_token por access_token.
 */
const getAuthClient = () => {
    const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    oauth2Client.setCredentials({
        refresh_token: REFRESH_TOKEN
    });
    // Manejo de eventos de actualización de credenciales (opcional, para debug)
    oauth2Client.on('tokens', (tokens) => {
        if (tokens.refresh_token) {
            console.log('Nota: Se ha recibido un nuevo refresh_token, deberías actualizar tu variable de entorno.');
        }
        // console.log('Nuevo access_token generado automáticamente');
    });
    return oauth2Client;
};
/**
 * Función principal para obtener el último PDF de la carpeta configurada.
 * Retorna el contenido del archivo como un Buffer.
 */
export async function getLatestPdfFromDrive() {
    try {
        const auth = getAuthClient();
        console.log('[OAuth] Cliente autenticado, solicitando token...');
        const drive = google.drive({ version: 'v3', auth });
        console.log('[Drive] Cliente Drive inicializado');
        console.log(`[Drive] Buscando PDFs en la carpeta: ${FOLDER_ID}`);
        // 1. Listar archivos: Solo PDFs, dentro de la carpeta, no borrados.
        // Ordenamos por 'createdTime desc' para obtener el más reciente primero.
        const res = await drive.files.list({
            q: `'${FOLDER_ID}' in parents and mimeType='application/pdf' and trashed=false`,
            orderBy: 'createdTime desc',
            pageSize: 1, // Solo necesitamos el último
            fields: 'files(id, name, createdTime, mimeType)'
        });
        const files = res.data.files;
        if (!files || files.length === 0) {
            console.log('[Drive] No se encontraron archivos PDF recientes en la carpeta.');
            return null;
        }
        const latestFile = files[0];
        console.log(`[Drive] Archivo más reciente encontrado: ${latestFile.name} (ID: ${latestFile.id}) creado el ${latestFile.createdTime}`);
        if (!latestFile.id) {
            throw new Error("El archivo no tiene ID válido.");
        }
        // 2. Descargar el archivo
        console.log(`[Drive] Descargando contenido...`);
        const fileRes = await drive.files.get({
            fileId: latestFile.id,
            alt: 'media',
        }, {
            responseType: 'arraybuffer', // Importante para obtener datos binarios en Node.js
        });
        const buffer = Buffer.from(fileRes.data as ArrayBuffer);
        console.log(`[Drive] Descarga completada. Tamaño: ${buffer.length} bytes.`);
        return {
            buffer,
            filename: latestFile.name || 'document.pdf'
        };
    }
    catch (error) {
        console.error('[Drive Error] Falló la operación en Drive:');
        if (error.response) {
            // Errores de la API de Google
            console.error(`Status: ${error.response.status}`);
            console.error(`Data: ${JSON.stringify(error.response.data)}`);
            if (error.response.status === 400 && error.response.data.error === 'invalid_grant') {
                console.error("CRÍTICO: El Refresh Token es inválido, ha expirado o ha sido revocado. Debes generar uno nuevo.");
            }
        }
        else {
            console.error(error.message);
        }
        throw error;
    }
}
