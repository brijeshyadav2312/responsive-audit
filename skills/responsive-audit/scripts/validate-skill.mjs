#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROFILES } from './devices.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const errors = [];
let skillVersion = null;
let packageVersion = null;
let evalsVersion = null;

function read(relative) {
  const absolute = join(root, relative);
  if (!existsSync(absolute)) {
    errors.push('Missing file: ' + relative);
    return null;
  }
  return readFileSync(absolute, 'utf8').replace(/^\uFEFF/, '');
}

if (basename(root) !== 'responsive-audit') {
  errors.push('skill folder must be named "responsive-audit" (found "' + basename(root) + '")');
}

const packageJson = read('package.json');
if (packageJson) {
  try {
    const parsed = JSON.parse(packageJson);
    packageVersion = parsed.version || null;
    if (parsed.name !== 'responsive-audit') {
      errors.push('package.json name must be "responsive-audit"');
    }
    if (!packageVersion) errors.push('package.json is missing a version');
  } catch (error) {
    errors.push('package.json is not valid JSON: ' + error.message);
  }
}

const skill = read('SKILL.md');
if (skill) {
  const frontmatter = skill.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!frontmatter) {
    errors.push('SKILL.md must start with YAML frontmatter');
  } else {
    const fields = {};
    for (const line of frontmatter[1].split(/\r?\n/)) {
      const match = line.match(/^([a-z-]+):\s*(.*)$/i);
      if (match) fields[match[1].toLowerCase()] = match[2].trim();
    }
    if (fields.name !== 'responsive-audit') {
      errors.push('frontmatter name must be "responsive-audit"');
    }
    if (!fields.description || fields.description.length < 40) {
      errors.push('frontmatter description is missing or too short');
    }
    if (fields.description && fields.description.length > 1024) {
      errors.push('frontmatter description must be at most 1024 characters');
    }
    const versionMatch = frontmatter[1].match(/^[ \t]+version:\s*(\S+)\s*$/m);
    if (versionMatch) skillVersion = versionMatch[1];
    if (packageVersion && skillVersion && packageVersion !== skillVersion) {
      errors.push(
        'SKILL.md metadata version ' +
          skillVersion +
          ' does not match package.json version ' +
          packageVersion
      );
    }
    if (!skillVersion) errors.push('SKILL.md metadata is missing a version');
  }

  const body = skill.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  const lines = body.split(/\r?\n/).length;
  if (lines > 240) errors.push('SKILL.md body is too long: ' + lines + ' lines (max 240)');
  for (const heading of ['## Workflow', '## Output contract', '## Autonomy rules']) {
    if (!body.includes(heading)) errors.push('SKILL.md is missing heading: ' + heading);
  }
  if (/\bTODO\b|TBD|FIXME/.test(body)) errors.push('SKILL.md contains a placeholder');
  if (/[^\x00-\x7F]/.test(skill)) errors.push('SKILL.md contains non-ASCII characters');

  const references = [...new Set(body.match(/references\/[A-Za-z0-9._-]+/g) || [])];
  if (!references.length) errors.push('SKILL.md does not reference any reference files');
  for (const reference of references) {
    if (!existsSync(join(root, reference))) errors.push('Missing reference: ' + reference);
  }
}

const devicesDoc = read('references/devices.json');
if (devicesDoc) {
  try {
    const parsed = JSON.parse(devicesDoc);
    const listed = Array.isArray(parsed.profiles) ? parsed.profiles : [];
    const moduleNames = new Set(PROFILES.map((profile) => profile.name));
    const listedNames = new Set(listed.map((profile) => profile.name));
    if (listed.length !== PROFILES.length) {
      errors.push(
        'references/devices.json has ' +
          listed.length +
          ' profiles but devices.mjs has ' +
          PROFILES.length
      );
    }
    for (const name of listedNames) {
      if (!moduleNames.has(name)) errors.push('devices.json lists unknown profile: ' + name);
    }
    for (const name of moduleNames) {
      if (!listedNames.has(name)) errors.push('devices.json is missing profile: ' + name);
    }
    for (const [group, names] of Object.entries(parsed.groups || {})) {
      if (!Array.isArray(names)) {
        errors.push('devices.json group "' + group + '" must be an array');
        continue;
      }
      for (const name of names) {
        if (!moduleNames.has(name)) {
          errors.push('devices.json group "' + group + '" lists unknown profile: ' + name);
        }
      }
    }
  } catch (error) {
    errors.push('references/devices.json is not valid JSON: ' + error.message);
  }
}

const evalsDoc = read('evals/evals.json');
if (evalsDoc) {
  try {
    const parsed = JSON.parse(evalsDoc);
    evalsVersion = parsed.version || null;
    const cases = Array.isArray(parsed.cases) ? parsed.cases : [];
    if (packageVersion && evalsVersion && packageVersion !== evalsVersion) {
      errors.push(
        'evals/evals.json version ' +
          evalsVersion +
          ' does not match package.json version ' +
          packageVersion
      );
    }
    if (!evalsVersion) errors.push('evals/evals.json is missing a version');
    if (cases.length < 8) errors.push('evals/evals.json needs at least 8 cases');
    if (!cases.some((item) => item.should_trigger === true)) {
      errors.push('evals/evals.json needs trigger cases');
    }
    if (!cases.some((item) => item.should_trigger === false)) {
      errors.push('evals/evals.json needs non-trigger cases');
    }
    for (const item of cases) {
      if (!item.id || !item.prompt) errors.push('eval case missing id or prompt');
    }
  } catch (error) {
    errors.push('evals/evals.json is not valid JSON: ' + error.message);
  }
}

if (errors.length) {
  console.error('validate-skill: FAILED');
  for (const error of errors) console.error('  - ' + error);
  process.exit(1);
}

console.log(
  'validate-skill: OK (' +
    PROFILES.length +
    ' profiles, ' +
    (skill ? 'SKILL.md valid' : 'SKILL.md missing') +
    ')'
);
