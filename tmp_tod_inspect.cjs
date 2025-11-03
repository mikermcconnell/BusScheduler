require('ts-node/register/transpile-only');

const fs = require('fs');
const path = require('path');

class FakeFile {
  constructor(name, contents) {
    this.name = name;
    this._contents = contents;
    this.type = 'text/csv';
    this.lastModified = Date.now();
  }

  get size() {
    return Buffer.byteLength(this._contents, 'utf8');
  }

  async text() {
    return this._contents;
  }
}

class FakeFileReader {
  constructor() {
    this.onload = null;
    this.onerror = null;
    this.result = null;
    this.error = null;
  }

  readAsText(file) {
    setImmediate(() => {
      Promise.resolve(file.text())
        .then((text) => {
          this.result = text;
          if (typeof this.onload === 'function') {
            this.onload({ target: this });
          }
        })
        .catch((error) => {
          this.error = error;
          if (typeof this.onerror === 'function') {
            this.onerror({ target: this, error });
          }
        });
    });
  }
}

global.File = FakeFile;
global.FileReader = FakeFileReader;

async function main() {
  const { parseCityRequirementsCsv, parseContractorShiftsCsv } = require('./src/TodShifts/utils/todShiftImport.ts');

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
  console.log('City weekday intervals:', payload.cityTimeline.weekday?.length);
  console.log('Operational weekday intervals:', payload.operationalTimeline.weekday?.length);
  console.log('Shifts count:', payload.shifts.length);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
