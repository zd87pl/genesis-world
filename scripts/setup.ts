#!/usr/bin/env npx tsx
/**
 * Genesis World - Interactive Setup Script
 *
 * Guides users through configuring the application by prompting for
 * API keys and environment settings, then generating a .env file.
 */

import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

const c = {
  title: (s: string) => `${colors.bright}${colors.cyan}${s}${colors.reset}`,
  section: (s: string) => `${colors.bright}${colors.magenta}${s}${colors.reset}`,
  success: (s: string) => `${colors.green}${s}${colors.reset}`,
  warning: (s: string) => `${colors.yellow}${s}${colors.reset}`,
  error: (s: string) => `${colors.red}${s}${colors.reset}`,
  dim: (s: string) => `${colors.dim}${s}${colors.reset}`,
  key: (s: string) => `${colors.bright}${s}${colors.reset}`,
};

interface Config {
  // Environment
  environment: 'local' | 'production';

  // AI Services
  anthropicApiKey: string;
  enableVoice: boolean;
  deepgramApiKey: string;
  elevenLabsApiKey: string;
  inworldApiKey: string;
  inworldApiSecret: string;
  inworldWorkspace: string;

  // Infrastructure
  databaseUrl: string;
  redisUrl: string;
  r2AccessKey: string;
  r2SecretKey: string;
  r2Bucket: string;
  r2PublicUrl: string;

  // Security
  jwtSecret: string;

  // Server
  port: number;
  clientUrl: string;
  logLevel: string;
}

class SetupWizard {
  private rl: readline.Interface;
  private config: Partial<Config> = {};

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  private async question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  private async confirm(prompt: string, defaultYes = true): Promise<boolean> {
    const hint = defaultYes ? 'Y/n' : 'y/N';
    const answer = await this.question(`${prompt} (${hint}): `);
    if (answer === '') return defaultYes;
    return answer.toLowerCase().startsWith('y');
  }

  private async select(prompt: string, options: string[]): Promise<number> {
    console.log(prompt);
    options.forEach((opt, i) => {
      console.log(`  ${c.key(`${i + 1})`)} ${opt}`);
    });
    while (true) {
      const answer = await this.question(`Enter choice (1-${options.length}): `);
      const num = parseInt(answer, 10);
      if (num >= 1 && num <= options.length) {
        return num - 1;
      }
      console.log(c.warning('Invalid choice, please try again.'));
    }
  }

  private generateSecret(length = 64): string {
    return crypto.randomBytes(length / 2).toString('hex');
  }

  private printHeader(): void {
    console.clear();
    console.log('');
    console.log(c.title('  ===================================='));
    console.log(c.title('       Genesis World Setup'));
    console.log(c.title('  ===================================='));
    console.log('');
    console.log(c.dim('  This wizard will help you configure'));
    console.log(c.dim('  your Genesis World instance.'));
    console.log('');
  }

  private printSection(title: string): void {
    console.log('');
    console.log(c.section(`--- ${title} ---`));
    console.log('');
  }

  async run(): Promise<void> {
    try {
      this.printHeader();

      // Step 1: Environment Selection
      this.printSection('Environment');
      const envChoice = await this.select('What environment are you setting up?', [
        'Local Development (uses Docker for PostgreSQL, Redis, MinIO)',
        'Production (you provide external service URLs)',
      ]);
      this.config.environment = envChoice === 0 ? 'local' : 'production';

      // Step 2: AI Services
      this.printSection('AI Services (Optional)');
      console.log(c.dim('These enable the AI Game Master and smart NPCs.'));
      console.log(c.dim('Press Enter to skip any key.\n'));

      const anthropicKey = await this.question(
        `${c.key('Anthropic API key')} ${c.dim('(for AI Game Master)')}: `
      );
      this.config.anthropicApiKey = anthropicKey;

      if (anthropicKey) {
        console.log(c.success('  AI Game Master will be enabled.'));
      } else {
        console.log(c.dim('  Skipped - using procedural generation.'));
      }

      // Voice features
      console.log('');
      const enableVoice = await this.confirm(
        `${c.key('Enable voice features?')} ${c.dim('(requires Deepgram + ElevenLabs)')}`,
        false
      );
      this.config.enableVoice = enableVoice;

      if (enableVoice) {
        this.config.deepgramApiKey = await this.question(
          `${c.key('Deepgram API key')} ${c.dim('(speech-to-text)')}: `
        );
        this.config.elevenLabsApiKey = await this.question(
          `${c.key('ElevenLabs API key')} ${c.dim('(text-to-speech)')}: `
        );
      }

      // Advanced NPC (Inworld)
      console.log('');
      const enableInworld = await this.confirm(
        `${c.key('Enable Inworld AI?')} ${c.dim('(advanced NPC conversations)')}`,
        false
      );

      if (enableInworld) {
        this.config.inworldApiKey = await this.question(`${c.key('Inworld API key')}: `);
        this.config.inworldApiSecret = await this.question(`${c.key('Inworld API secret')}: `);
        this.config.inworldWorkspace = await this.question(`${c.key('Inworld workspace')}: `);
      }

      // Step 3: Infrastructure (only for production)
      if (this.config.environment === 'production') {
        this.printSection('Infrastructure');
        console.log(c.dim('Provide URLs for your external services.\n'));

        this.config.databaseUrl = await this.question(
          `${c.key('PostgreSQL URL')} ${c.dim('(e.g., postgres://user:pass@host:5432/db)')}: `
        );

        this.config.redisUrl = await this.question(
          `${c.key('Redis URL')} ${c.dim('(e.g., redis://host:6379)')}: `
        );

        const enableR2 = await this.confirm(
          `${c.key('Configure Cloudflare R2 storage?')}`,
          false
        );

        if (enableR2) {
          this.config.r2AccessKey = await this.question(`${c.key('R2 Access Key')}: `);
          this.config.r2SecretKey = await this.question(`${c.key('R2 Secret Key')}: `);
          this.config.r2Bucket = await this.question(
            `${c.key('R2 Bucket')} ${c.dim('(default: genesis-assets)')}: `
          ) || 'genesis-assets';
          this.config.r2PublicUrl = await this.question(`${c.key('R2 Public URL')}: `);
        }
      } else {
        // Local defaults
        this.config.databaseUrl = 'postgres://genesis:genesis_dev_password@localhost:5432/genesis_world';
        this.config.redisUrl = 'redis://localhost:6379';
      }

      // Step 4: Security
      this.printSection('Security');

      const autoGenerate = await this.confirm(
        `${c.key('Auto-generate JWT secret?')} ${c.dim('(recommended)')}`,
        true
      );

      if (autoGenerate) {
        this.config.jwtSecret = this.generateSecret(64);
        console.log(c.success('  Generated secure 64-character secret.'));
      } else {
        this.config.jwtSecret = await this.question(`${c.key('Enter JWT secret')}: `);
      }

      // Step 5: Server Config (optional)
      this.printSection('Server Configuration');

      const customServer = await this.confirm(
        `${c.key('Customize server settings?')} ${c.dim('(port, URLs)')}`,
        false
      );

      if (customServer) {
        const portStr = await this.question(
          `${c.key('Server port')} ${c.dim('(default: 3000)')}: `
        );
        this.config.port = portStr ? parseInt(portStr, 10) : 3000;

        this.config.clientUrl = await this.question(
          `${c.key('Client URL')} ${c.dim('(default: http://localhost:5173)')}: `
        ) || 'http://localhost:5173';

        const logChoice = await this.select('Log level:', [
          'error (minimal)',
          'warn',
          'info (default)',
          'debug (verbose)',
        ]);
        this.config.logLevel = ['error', 'warn', 'info', 'debug'][logChoice];
      } else {
        this.config.port = 3000;
        this.config.clientUrl = 'http://localhost:5173';
        this.config.logLevel = 'info';
      }

      // Step 6: Summary
      this.printSection('Configuration Summary');
      this.printSummary();

      // Step 7: Save
      console.log('');
      const save = await this.confirm(`${c.key('Save configuration to .env?')}`, true);

      if (save) {
        this.writeEnvFile();
        console.log(c.success('\n  Configuration saved to .env'));
      } else {
        console.log(c.warning('\n  Configuration not saved.'));
      }

      // Step 8: Start Docker (for local dev)
      if (this.config.environment === 'local' && save) {
        console.log('');
        const startDocker = await this.confirm(
          `${c.key('Start Docker services?')} ${c.dim('(PostgreSQL, Redis, MinIO)')}`,
          true
        );

        if (startDocker) {
          console.log(c.dim('\n  Starting Docker services...'));
          try {
            execSync('docker compose up -d', {
              cwd: path.resolve(__dirname, '..'),
              stdio: 'inherit',
            });
            console.log(c.success('\n  Docker services started.'));
          } catch (error) {
            console.log(c.error('\n  Failed to start Docker services.'));
            console.log(c.dim('  Run manually: docker compose up -d'));
          }
        }
      }

      // Final message
      console.log('');
      console.log(c.title('  ===================================='));
      console.log(c.success('       Setup Complete!'));
      console.log(c.title('  ===================================='));
      console.log('');
      console.log(`  Next steps:`);
      console.log(`    1. ${c.key('pnpm install')}     - Install dependencies`);
      console.log(`    2. ${c.key('pnpm dev')}         - Start development server`);
      console.log(`    3. Open ${c.key('http://localhost:5173')} in browser`);
      console.log('');

      this.rl.close();
    } catch (error) {
      console.error(c.error('\nSetup failed:'), error);
      this.rl.close();
      process.exit(1);
    }
  }

  private printSummary(): void {
    const check = c.success('');
    const cross = c.dim('');

    console.log(`  Environment:      ${c.key(this.config.environment === 'local' ? 'Local Development' : 'Production')}`);
    console.log(`  AI Game Master:   ${this.config.anthropicApiKey ? check + ' Enabled' : cross + ' Disabled'}`);
    console.log(`  Voice Features:   ${this.config.enableVoice ? check + ' Enabled' : cross + ' Disabled'}`);
    console.log(`  Inworld AI:       ${this.config.inworldApiKey ? check + ' Enabled' : cross + ' Disabled'}`);
    console.log(`  Database:         ${this.config.environment === 'local' ? 'Docker PostgreSQL' : c.dim('Custom')}`);
    console.log(`  Redis:            ${this.config.environment === 'local' ? 'Docker Redis' : c.dim('Custom')}`);
    console.log(`  R2 Storage:       ${this.config.r2AccessKey ? check + ' Configured' : cross + ' Not configured'}`);
    console.log(`  JWT Secret:       ${check} Generated`);
  }

  private writeEnvFile(): void {
    const envPath = path.resolve(__dirname, '..', '.env');

    const lines: string[] = [
      '# Genesis World Configuration',
      '# Generated by setup wizard',
      `# ${new Date().toISOString()}`,
      '',
      '# ============================================',
      '# AI Services',
      '# ============================================',
      `ANTHROPIC_API_KEY=${this.config.anthropicApiKey || ''}`,
      `DEEPGRAM_API_KEY=${this.config.deepgramApiKey || ''}`,
      `ELEVENLABS_API_KEY=${this.config.elevenLabsApiKey || ''}`,
      `INWORLD_API_KEY=${this.config.inworldApiKey || ''}`,
      `INWORLD_API_SECRET=${this.config.inworldApiSecret || ''}`,
      `INWORLD_WORKSPACE=${this.config.inworldWorkspace || ''}`,
      '',
      '# ============================================',
      '# Infrastructure',
      '# ============================================',
      `DATABASE_URL=${this.config.databaseUrl || ''}`,
      `REDIS_URL=${this.config.redisUrl || ''}`,
      '',
      '# Cloudflare R2 (optional)',
      `R2_ACCESS_KEY=${this.config.r2AccessKey || ''}`,
      `R2_SECRET_KEY=${this.config.r2SecretKey || ''}`,
      `R2_BUCKET=${this.config.r2Bucket || 'genesis-assets'}`,
      `R2_PUBLIC_URL=${this.config.r2PublicUrl || ''}`,
      '',
      '# ============================================',
      '# Security',
      '# ============================================',
      `JWT_SECRET=${this.config.jwtSecret}`,
      '',
      '# ============================================',
      '# Server Configuration',
      '# ============================================',
      `PORT=${this.config.port}`,
      `CLIENT_URL=${this.config.clientUrl}`,
      `LOG_LEVEL=${this.config.logLevel}`,
      '',
    ];

    fs.writeFileSync(envPath, lines.join('\n'));
  }
}

// Run the wizard
const wizard = new SetupWizard();
wizard.run();
