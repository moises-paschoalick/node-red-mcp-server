#!/usr/bin/env node

/**
 * Generate Admin Password Script (simplificado)
 * Gera uma senha segura para o admin do Node-RED e atualiza o settings.js
 */

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const fs = require('fs');

function generateSecurePassword(length = 16) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[crypto.randomInt(26)];
    password += 'abcdefghijklmnopqrstuvwxyz'[crypto.randomInt(26)];
    password += '0123456789'[crypto.randomInt(10)];
    password += '!@#$%^&*'[crypto.randomInt(8)];
    for (let i = 4; i < length; i++) {
        password += charset[crypto.randomInt(charset.length)];
    }
    return password.split('').sort(() => 0.5 - Math.random()).join('');
}

function updateSettingsFile(passwordHash) {
    const settingsPath = '/data/settings.js';
    try {
        let settingsContent = fs.readFileSync(settingsPath, 'utf8');
        // Remove qualquer bloco adminAuth comentado
        settingsContent = settingsContent.replace(/\n\s*\/\/adminAuth:[\s\S]*?\},?\n/g, '\n');
        // Remove qualquer bloco adminAuth ativo
        settingsContent = settingsContent.replace(/\n\s*adminAuth:[\s\S]*?\},?\n/g, '\n');
        // Insere o novo bloco adminAuth após o comentário de segurança
        const securityComment = /\*\*\/[\s\S]*?\*\s+-\s+adminAuth[\s\S]*?\*\//;
        const newAdminAuth = `adminAuth: {
        type: "credentials",
        users: [{
            username: "admin",
            password: "${passwordHash}",
            permissions: "*"
        }]
    },\n`;
        // Insere logo após o comentário de segurança
        settingsContent = settingsContent.replace(securityComment, match => match + '\n    ' + newAdminAuth);
        fs.writeFileSync(settingsPath, settingsContent, 'utf8');
        console.log('✅ Settings file updated with new admin password');
    } catch (error) {
        console.error('❌ Error updating settings file:', error.message);
        process.exit(1);
    }
}

function main() {
    console.log('🔐 Generating secure admin password for Node-RED...');
    
    // Check if there's a password defined in environment variable
    const envPassword = process.env.NODE_RED_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
    const password = envPassword || generateSecurePassword(20);
    
    if (envPassword) {
        console.log('🔑 Using password provided via environment variable...');
    } else {
        console.log('🔑 Generating random password...');
    }
    
    const saltRounds = 12;
    const passwordHash = bcrypt.hashSync(password, saltRounds);
    updateSettingsFile(passwordHash);
    
    console.log('\n' + '='.repeat(60));
    console.log('🚀 NODE-RED ADMIN CREDENTIALS');
    console.log('='.repeat(60));
    console.log(`👤 Username: admin`);
    console.log(`🔑 Password: ${password}`);
    console.log('='.repeat(60));
    if (!envPassword) {
        console.log('⚠️  Random password — changes on every redeploy!');
        console.log('');
        console.log('👉 Set a permanent password on Railway:');
        console.log('   Dashboard → your service → Variables → Add:');
        console.log('   ADMIN_PASSWORD=your-chosen-password');
        console.log('   Then redeploy.');
    } else {
        console.log('✅ Password set from ADMIN_PASSWORD environment variable.');
    }
    console.log('='.repeat(60) + '\n');
}

if (require.main === module) {
    main();
} 