import fs from 'fs';
import path from 'path';

class FakeFile {
  name: string;
  private readonly contents: string;
  lastModified: number;
  type: string;

  constructor(name: string, contents: string) {
    this.name = name;
    this.contents = contents;
    this.lastModified = Date.now();
    this.type = 'text/csv';
  }

  get size(): number {
    return Buffer.byteLength(this.contents, 'utf8');
  }

  async text(): Promise<string> {
    return this.contents;
  }
}

class FakeFileReader {
  onload: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  result: string | null = null;
  error: unknown;

  readAsText(file: FakeFile) {
    setImmediate(() => {
      (file.text() as Promise<string>)
        .then((text) => {
          this.result = text;
          if (typeof this.onload === 'function') {
            this.onload({ target: this });
          }
        })
        .catch((err) => {
          this.error = err;
          if (typeof this.onerror === 'function') {
            this.onerror({ target: this, error: err });
          }
        });
    });
  }
}

(globalThis as any).File = FakeFile;
(globalThis as any).FileReader = FakeFileReader;

async function main() {
  const { parseCityRequirementsCsv, parseContractorShiftsCsv } = await import('./src/TodShifts/utils/todShiftImport');

  const cityPath = path.resolve('./08.2025 Schedule Master (TOD).csv');
  const contractorPath = path.resolve('./Copy of Template - ToD Shifts November 16 2025 Develop (002).csv');

  const cityContents = fs.readFileSync(cityPath, 'utf8');
  const contractorContents = fs.readFileSync(contractorPath, 'utf8');

  const cityFile = new FakeFile(path.basename(cityPath), cityContents);
  const contractorFile = new FakeFile(path.basename(contractorPath), contractorContents);

  const cityTimeline = await parseCityRequirementsCsv(cityFile as unknown as File);
  const contractorResult = await parseContractorShiftsCsv(contractorFile as unknown as File);

  const payload = {
    cityFileName: cityFile.name,
    contractorFileName: contractorFile.name,
    importedAt: new Date().toISOString(),
    cityTimeline,
    operationalTimeline: contractorResult.operationalTimeline,
    shifts: contractorResult.shifts
  };

  function sanitizeValue(value: any): any {
    if (value === undefined) {
      return null;
    }

    if (Array.isArray(value)) {
      return value.map(item => {
        const sanitized = sanitizeValue(item);
        return sanitized === undefined ? null : sanitized;
      });
    }

    if (value && typeof value === 'object') {
      const result: Record<string, any> = {};
      Object.entries(value).forEach(([key, val]) => {
        const sanitized = sanitizeValue(val);
        if (sanitized !== undefined) {
          result[key] = sanitized;
        }
      });
      return result;
    }

    return value;
  }

  const sanitizedPayload = sanitizeValue(payload);

  const issues: string[] = [];

  function inspect(value: any, path: string) {
    if (value === undefined) {
      issues.push(`${path} is undefined`);
      return;
    }

    if (typeof value === 'number' && !Number.isFinite(value)) {
      issues.push(`${path} is not finite (${value})`);
      return;
    }

    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        value.forEach((item, index) => inspect(item, `${path}[${index}]`));
      } else {
        Object.entries(value).forEach(([key, val]) => inspect(val, `${path}.${key}`));
      }
    }
  }

  inspect(sanitizedPayload, 'payload');

  const json = JSON.stringify(sanitizedPayload);
  console.log('Payload size (bytes):', Buffer.byteLength(json, 'utf8'));
  console.log('City weekday intervals:', sanitizedPayload.cityTimeline.weekday?.length);
  console.log('Operational weekday intervals:', sanitizedPayload.operationalTimeline.weekday?.length);
  console.log('Shifts count:', sanitizedPayload.shifts.length);
  if (issues.length > 0) {
    console.log('Issues detected:');
    issues.forEach(issue => console.log(' -', issue));
  } else {
    console.log('No undefined or non-finite numeric values detected.');
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
