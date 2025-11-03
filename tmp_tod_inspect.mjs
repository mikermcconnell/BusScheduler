import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

register('ts-node/esm', pathToFileURL('./'));

class FakeFile {
  constructor(name, text) {
    this.name = name;
    this._text = text;
    this.lastModified = Date.now();
    this.type = 'text/csv';
  }

  get size() {
    return Buffer.byteLength(this._text, 'utf8');
  }

  async text() {
    return this._text;
  }
}

class FakeFileReader {
  constructor() {
    this.onload = null;
    this.onerror = null;
    this.result = null;
  }

  readAsText(file) {
    setImmediate(() => {
      try {
        this.result = file._text;
        if (typeof this.onload === 'function') {
          this.onload({ target: this });
        }
      } catch (error) {
        this.error = error;
        if (typeof this.onerror === 'function') {
          this.onerror({ target: this, error });
        }
      }
    });
  }
}

globalThis.File = FakeFile;
globalThis.FileReader = FakeFileReader;

const { parseCityRequirementsCsv, parseContractorShiftsCsv } = await import('./src/TodShifts/utils/todShiftImport.ts');

const cityPath = path.resolve('./08.2025 Schedule Master (TOD).csv');
const contractorPath = path.resolve('./Copy of Template - ToD Shifts November 16 2025 Develop (002).csv');

const cityContents = fs.readFileSync(cityPath, 'utf8');
const contractorContents = fs.readFileSync(contractorPath, 'utf8');

const cityFile = new FakeFile(path.basename(cityPath), cityContents);
const contractorFile = new FakeFile(path.basename(contractorPath), contractorContents);

const cityTimeline = await parseCityRequirementsCsv(cityFile);
const contractorResult = await parseContractorShiftsCsv(contractorFile);

const payload = {
  cityFileName: cityFile.name,
  contractorFileName: contractorFile.name,
  importedAt: new Date().toISOString(),
  cityTimeline,
  operationalTimeline: contractorResult.operationalTimeline,
  shifts: contractorResult.shifts
};

const json = JSON.stringify(payload);

console.log('Payload size (bytes):', Buffer.byteLength(json, 'utf8'));
console.log('City timeline weekday intervals:', payload.cityTimeline.weekday.length);
console.log('Operational weekday intervals:', payload.operationalTimeline.weekday.length);
console.log('Shifts count:', payload.shifts.length);
