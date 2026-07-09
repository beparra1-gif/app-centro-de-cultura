#!/usr/bin/env node

/**
 * Helper script para preparar deploy a DigitalOcean
 * Genera JWT_SECRET y da instrucciones paso a paso
 */

const crypto = require('crypto');

console.log('\n' + '='.repeat(60));
console.log('🚀 PREPARE DEPLOY - Centro de Cultura Física');
console.log('='.repeat(60) + '\n');

// 1. Generar JWT_SECRET
const jwtSecret = crypto.randomBytes(32).toString('hex');

console.log('✅ JWT_SECRET generado:');
console.log(`\n${jwtSecret}\n`);
console.log('⚠️  GUARDAR EN LUGAR SEGURO (no commitear a GitHub)\n');

// 2. Verificar archivos necesarios
const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'backend/server.js',
  'backend/package.json',
  'backend/migrations/init.js',
  'src/App.jsx',
  'src/api/client.js',
  'package.json',
  'vite.config.js',
];

console.log('📋 Verificando archivos requeridos:\n');
let allFilesExist = true;
requiredFiles.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, '..', file));
  const status = exists ? '✅' : '❌';
  console.log(`${status} ${file}`);
  if (!exists) allFilesExist = false;
});

console.log('\n' + '='.repeat(60));

if (allFilesExist) {
  console.log('✅ Todos los archivos necesarios están presentes');
  console.log('\n📝 PRÓXIMOS PASOS:\n');
  console.log('1. Crear cuenta en DigitalOcean:');
  console.log('   → https://www.digitalocean.com/\n');
  
  console.log('2. Crear PostgreSQL Managed Database:');
  console.log('   → Copiar CONNECTION_STRING\n');
  
  console.log('3. En DigitalOcean Panel:');
  console.log('   → Apps > Create App > Connect GitHub\n');
  
  console.log('4. Agregar estas variables de entorno:\n');
  
  console.log('   DATABASE_URL');
  console.log('   (Copiar desde PostgreSQL > Connection)\n');
  
  console.log('   JWT_SECRET');
  console.log(`   ${jwtSecret}\n`);
  
  console.log('   FRONTEND_URL');
  console.log('   (Tu URL de Vercel, ej: https://app-centro-de-cultura.vercel.app)\n');
  
  console.log('   NODE_ENV=production');
  console.log('   PORT=3000\n');
  
  console.log('5. Deploy en DigitalOcean');
  console.log('6. Conectar Frontend a Vercel\n');
  
} else {
  console.log('❌ Faltan archivos. Verifica tu estructura de carpetas');
  process.exit(1);
}

console.log('='.repeat(60) + '\n');
console.log('📚 Para más detalles ver:');
console.log('   → DEPLOY_INSTRUCTIONS.md');
console.log('   → ENV_VARIABLES.md\n');
