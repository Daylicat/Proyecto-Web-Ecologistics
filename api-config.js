// ─── api-config.js ───
const SUPABASE_URL = 'https://bpbsexgtpxrlkjyyequq.supabase.co';
// Coloca aquí adentro tu clave larga anon public que obtienes de Settings -> API en Supabase
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwYnNleGd0cHhybGtqeXllcXVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1OTk0MjgsImV4cCI6MjA5NjE3NTQyOH0.fXx67xB_-WV5mwmdhe-R00xy3MJ-L_8dytcjMZULX-U';

async function peticionAPI(tabla, metodo = 'GET', datos = null) {
  const url = `${SUPABASE_URL}/rest/v1/${tabla}`;
  
  const opciones = {
    method: metodo,
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  };

  if (datos && (metodo === 'POST' || metodo === 'PUT')) {
    opciones.body = JSON.stringify(datos);
  }

  try {
    const respuesta = await fetch(url, opciones);
    if (!respuesta.ok) throw new Error(`Error: ${respuesta.statusText}`);
    return await respuesta.json();
  } catch (error) {
    console.error(`Error de conexión en tabla ${tabla}:`, error);
    return null;
  }
}