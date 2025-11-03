import quickAdjustStorage from './quickAdjustStorage';

const draftId = 'test-draft';

describe('quickAdjustStorage', () => {
  afterEach(() => {
    quickAdjustStorage.clear(draftId);
    window.localStorage.clear();
  });

  it('persists and restores raw rows', () => {
    const payload = {
      rows: [
        ['Row', 'Header'],
        ['07:00', '07:30']
      ],
      fileName: 'sample.csv',
      savedAt: new Date().toISOString()
    };

    quickAdjustStorage.save(draftId, payload);

    const restored = quickAdjustStorage.load(draftId);
    expect(restored).not.toBeNull();
    expect(restored?.rows).toEqual(payload.rows);
    expect(restored?.fileName).toBe(payload.fileName);
  });

  it('returns null when no payload is stored', () => {
    expect(quickAdjustStorage.load(draftId)).toBeNull();
  });
});
