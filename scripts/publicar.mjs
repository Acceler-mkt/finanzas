// Publica la app: genera dist/ y lo sube a la rama "gh-pages" del repositorio, que es la que
// sirve GitHub Pages. El código fuente va aparte, en la rama principal.
//
// Uso: npm run publicar
// Si existe .env.local, la app publicada usa tu Supabase; si no, sale con datos de prueba.

import { execSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(raiz, 'dist');
const en = (cwd) => (orden) => execSync(orden, { cwd, stdio: 'inherit' });
const leer = (orden) => execSync(orden, { cwd: raiz, encoding: 'utf8' }).trim();

const remoto = leer('git remote get-url origin');
const nombre = leer('git config user.name');
const correo = leer('git config user.email');

console.log(existsSync(join(raiz, '.env.local')) ? '→ Con Supabase (.env.local)' : '→ Con datos de prueba (no hay .env.local)');

en(raiz)('npm run build');
writeFileSync(join(dist, '.nojekyll'), ''); // que GitHub sirva los archivos tal cual

const git = en(dist);
rmSync(join(dist, '.git'), { recursive: true, force: true });
git('git init -q -b gh-pages');
git(`git config user.name "${nombre}"`);
git(`git config user.email "${correo}"`);
git('git add -A');
git('git commit -q -m "Publicar la app"');
git(`git push -q --force "${remoto}" gh-pages`);
rmSync(join(dist, '.git'), { recursive: true, force: true });

console.log('Publicada. GitHub tarda alrededor de un minuto en actualizar el enlace.');
