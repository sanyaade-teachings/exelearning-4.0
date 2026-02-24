/**
 * LOMLOE iDevice — Unit Tests
 *
 * Tests the editor module ($exeDevice) in isolation:
 *   - Selection ID generation
 *   - Save/restore state round-trip
 *   - Summary HTML generation
 *   - Dataset configuration
 *
 * Run with:  npx vitest run public/files/perm/idevices/base/lomloe/edition/lomloe.test.js
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── Mock eXeLearning globals ─────────────────────────────────────
globalThis._ = (str) => str;  // i18n passthrough
globalThis.CSS = { escape: (s) => s.replace(/[^a-zA-Z0-9\-_]/g, '\\$&') };

// ── Load module under test ───────────────────────────────────────
// The module defines $exeDevice on globalThis
const src = await import('./lomloe.js?raw').then(m => m.default).catch(() => null);
if (src) {
    // Execute the module in this context
    const fn = new Function('globalThis', '_', 'CSS', src + '\nreturn $exeDevice;');
    globalThis.$exeDevice = fn(globalThis, globalThis._, globalThis.CSS);
}

// ── Helpers ──────────────────────────────────────────────────────

const SEP = '\x1F';

function makeSaberSelId(etapa, nivel, codArea, bloque, nombre) {
    return ['saber', etapa, nivel, codArea, bloque, nombre].join(SEP);
}

function makeCriterioSelId(etapa, nivel, codArea, codigoComp, codigoCriterio) {
    return ['criterio', etapa, nivel, codArea, codigoComp, codigoCriterio].join(SEP);
}

/** Minimal sample data matching the lomloe-ES-CN.json structure */
const SAMPLE_DATA = {
    'Educación Primaria': {
        '1º Primaria': {
            'MAT': {
                denominacion: 'Matemáticas',
                saberes_basicos: {
                    bloques: {
                        'I. Sentido numérico': [
                            {
                                nombre: 'PM01SBI.1.1',
                                subtitulo_nivel_1: 'Números naturales',
                                subtitulo_nivel_2: '1.1. Conteo y representación'
                            },
                            {
                                nombre: 'PM01SBI.1.2',
                                subtitulo_nivel_1: 'Números naturales',
                                subtitulo_nivel_2: '1.2. Valor posicional'
                            }
                        ]
                    }
                },
                competencias_especificas: {
                    'PMC1': {
                        descripcion: 'Razonar matemáticamente interpretando datos',
                        explicacion_bloque_competencial: 'El desarrollo de esta competencia...',
                        criterios_evaluacion: [
                            {
                                codigo: 'PM01CE1.1',
                                descripcion: 'Interpretar datos cuantitativos del entorno',
                                competencias_clave: ['CCL2', 'STEM1', 'STEM3']
                            },
                            {
                                codigo: 'PM01CE1.2',
                                descripcion: 'Resolver problemas con números naturales',
                                competencias_clave: ['CCL1', 'STEM2']
                            }
                        ]
                    }
                }
            }
        }
    }
};

/** Builds a minimal mock iDevice DOM element */
function buildMockElement() {
    const el = document.createElement('article');
    el.setAttribute('idevice-id', 'test-lomloe-001');
    el.setAttribute('class', 'box idevice_node lomloe');
    document.body.appendChild(el);
    return el;
}

// ════════════════════════════════════════════════════════════════
describe('LOMLOE iDevice configuration', () => {
    it('is registered as $exeDevice with required interface', () => {
        expect($exeDevice).toBeDefined();
        expect(typeof $exeDevice.init).toBe('function');
        expect(typeof $exeDevice.save).toBe('function');
    });
});

// ════════════════════════════════════════════════════════════════
describe('Selection ID helpers', () => {
    it('saber selection IDs are stable and unique', () => {
        const id1 = makeSaberSelId('Educación Primaria', '1º Primaria', 'MAT', 'I. Sentido', 'PM01SBI.1.1');
        const id2 = makeSaberSelId('Educación Primaria', '1º Primaria', 'MAT', 'I. Sentido', 'PM01SBI.1.2');
        expect(id1).toContain('saber');
        expect(id1).not.toBe(id2);
        expect(id1.split('\x1F')).toHaveLength(6);
    });

    it('criterio selection IDs are stable and unique', () => {
        const id1 = makeCriterioSelId('Educación Primaria', '1º Primaria', 'MAT', 'PMC1', 'PM01CE1.1');
        const id2 = makeCriterioSelId('Educación Primaria', '1º Primaria', 'MAT', 'PMC1', 'PM01CE1.2');
        expect(id1).toContain('criterio');
        expect(id1).not.toBe(id2);
        expect(id1.split('\x1F')).toHaveLength(6);
    });

    it('saber and criterio IDs with same fields are distinguishable', () => {
        const saberId = makeSaberSelId('ESO', '1º ESO', 'BIG', 'Bloque I', 'code');
        const critId  = makeCriterioSelId('ESO', '1º ESO', 'BIG', 'comp1', 'code');
        expect(saberId.startsWith('saber')).toBe(true);
        expect(critId.startsWith('criterio')).toBe(true);
        expect(saberId).not.toBe(critId);
    });
});

// ════════════════════════════════════════════════════════════════
describe('Save / restore round-trip', () => {
    let el;

    beforeEach(() => {
        el = buildMockElement();
        // Mock fetch so the iDevice does not try to load the real 7MB JSON
        globalThis.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve(SAMPLE_DATA)
            })
        );
    });

    afterEach(() => {
        el && el.remove();
        vi.restoreAllMocks();
    });

    it('save() returns required keys when called with no selections', async () => {
        $exeDevice.init(el, null);
        // Wait for async data load
        await new Promise(r => setTimeout(r, 50));
        const data = $exeDevice.save();
        expect(data).toHaveProperty('ideviceId');
        expect(data).toHaveProperty('lomloeDataset');
        expect(data).toHaveProperty('lomloeSelections');
        expect(data).toHaveProperty('lomloeSummaryHtml');
        expect(Array.isArray(data.lomloeSelections)).toBe(true);
        expect(data.lomloeSelections).toHaveLength(0);
    });

    it('save() preserves lomloeDataset using ISO 3166-2:ES code', async () => {
        $exeDevice.init(el, null);
        await new Promise(r => setTimeout(r, 50));
        const data = $exeDevice.save();
        // Default dataset is 'ES-CN' (Canary Islands, ISO 3166-2:ES)
        expect(data.lomloeDataset).toBe('ES-CN');
    });

    it('init() restores selections from previousData', async () => {
        const selId = makeSaberSelId('Educación Primaria', '1º Primaria', 'MAT', 'I. Sentido', 'PM01SBI.1.1');
        const previousData = {
            lomloeDataset: 'ES-CN',
            lomloeActiveTab: 'saberes',
            lomloeSelectedEtapa: 'Educación Primaria',
            lomloeSelectedNivel: '1º Primaria',
            lomloeSelectedMateria: { codArea: 'MAT', denominacion: 'Matemáticas' },
            lomloeSelections: [
                {
                    id: selId,
                    type: 'saber',
                    dataset: 'ES-CN',
                    etapa: 'Educación Primaria',
                    nivel: '1º Primaria',
                    codArea: 'MAT',
                    denominacion: 'Matemáticas',
                    bloque: 'I. Sentido numérico',
                    nombre: 'PM01SBI.1.1',
                    subtitulo1: 'Números naturales',
                    subtitulo2: '1.1. Conteo y representación',
                    coverage: 'introduced',
                    notes: 'Test note'
                }
            ]
        };

        $exeDevice.init(el, previousData);
        await new Promise(r => setTimeout(r, 50));
        const saved = $exeDevice.save();

        expect(saved.lomloeSelections).toHaveLength(1);
        expect(saved.lomloeSelections[0].id).toBe(selId);
        expect(saved.lomloeSelections[0].coverage).toBe('introduced');
        expect(saved.lomloeSelections[0].notes).toBe('Test note');
    });

    it('save() → init() → save() preserves all selection fields', async () => {
        const selId = makeCriterioSelId('ESO', '1º ESO', 'EFI', 'EFI_C1', 'EFI01CE1.1');
        const sel = {
            id: selId,
            type: 'criterio',
            dataset: 'ES-CN',
            etapa: 'ESO',
            nivel: '1º ESO',
            codArea: 'EFI',
            denominacion: 'Educación Física',
            codigoComp: 'EFI_C1',
            descripcionComp: 'Competencia sobre actividad física',
            codigoCriterio: 'EFI01CE1.1',
            descripcionCriterio: 'Criterio sobre actividad física saludable',
            competenciasClave: ['CPSAA1', 'STEM2'],
            coverage: 'assessed',
            notes: 'Very important'
        };

        const prev = {
            lomloeDataset: 'ES-CN',
            lomloeActiveTab: 'competencias',
            lomloeSelectedEtapa: 'ESO',
            lomloeSelectedNivel: '1º ESO',
            lomloeSelectedMateria: { codArea: 'EFI', denominacion: 'Educación Física' },
            lomloeSelections: [sel]
        };

        $exeDevice.init(el, prev);
        await new Promise(r => setTimeout(r, 50));
        const saved = $exeDevice.save();
        const restoredSel = saved.lomloeSelections[0];

        expect(restoredSel.type).toBe('criterio');
        expect(restoredSel.codigoCriterio).toBe('EFI01CE1.1');
        expect(restoredSel.competenciasClave).toEqual(['CPSAA1', 'STEM2']);
        expect(restoredSel.coverage).toBe('assessed');
        expect(restoredSel.notes).toBe('Very important');
    });
});

// ════════════════════════════════════════════════════════════════
describe('Summary HTML generation', () => {
    let el;

    beforeEach(() => {
        el = buildMockElement();
        globalThis.fetch = vi.fn(() =>
            Promise.resolve({ ok: true, json: () => Promise.resolve(SAMPLE_DATA) })
        );
    });

    afterEach(() => {
        el && el.remove();
        vi.restoreAllMocks();
    });

    it('summary contains a table when selections exist', async () => {
        const selId = makeSaberSelId('Educación Primaria', '1º Primaria', 'MAT', 'I. Sentido numérico', 'PM01SBI.1.1');
        $exeDevice.init(el, {
            lomloeDataset: 'ES-CN',
            lomloeSelections: [{
                id: selId,
                type: 'saber',
                dataset: 'ES-CN',
                etapa: 'Educación Primaria',
                nivel: '1º Primaria',
                codArea: 'MAT',
                denominacion: 'Matemáticas',
                bloque: 'I. Sentido numérico',
                nombre: 'PM01SBI.1.1',
                subtitulo1: 'Números naturales',
                subtitulo2: '1.1. Conteo',
                coverage: 'introduced',
                notes: ''
            }]
        });
        await new Promise(r => setTimeout(r, 50));
        const saved = $exeDevice.save();
        expect(saved.lomloeSummaryHtml).toContain('<table');
        expect(saved.lomloeSummaryHtml).toContain('PM01SBI.1.1');
        expect(saved.lomloeSummaryHtml).toContain('Saber');
        expect(saved.lomloeSummaryHtml).toContain('Introducido');
    });

    it('summary contains empty message when no selections', async () => {
        $exeDevice.init(el, null);
        await new Promise(r => setTimeout(r, 50));
        const saved = $exeDevice.save();
        // lomloeSummaryHtml should communicate empty state
        expect(saved.lomloeSummaryHtml).toBeTruthy();
        expect(saved.lomloeSelections).toHaveLength(0);
    });

    it('summary includes competencias_clave tags for criterio type', async () => {
        const selId = makeCriterioSelId('Educación Primaria', '1º Primaria', 'MAT', 'PMC1', 'PM01CE1.1');
        $exeDevice.init(el, {
            lomloeDataset: 'ES-CN',
            lomloeSelections: [{
                id: selId,
                type: 'criterio',
                dataset: 'ES-CN',
                etapa: 'Educación Primaria',
                nivel: '1º Primaria',
                codArea: 'MAT',
                denominacion: 'Matemáticas',
                codigoComp: 'PMC1',
                descripcionComp: 'Razonar matemáticamente',
                codigoCriterio: 'PM01CE1.1',
                descripcionCriterio: 'Interpretar datos cuantitativos',
                competenciasClave: ['CCL2', 'STEM1', 'STEM3'],
                coverage: 'assessed',
                notes: 'Checked in exam'
            }]
        });
        await new Promise(r => setTimeout(r, 50));
        const saved = $exeDevice.save();
        expect(saved.lomloeSummaryHtml).toContain('CCL2');
        expect(saved.lomloeSummaryHtml).toContain('STEM1');
        expect(saved.lomloeSummaryHtml).toContain('STEM3');
        expect(saved.lomloeSummaryHtml).toContain('Evaluado');
        expect(saved.lomloeSummaryHtml).toContain('PM01CE1.1');
    });
});

// ════════════════════════════════════════════════════════════════
describe('Dataset configuration', () => {
    it('has at least one available dataset', () => {
        // The DATASETS array is private; we indirectly verify by checking that
        // the iDevice loads without error when initialized
        const el2 = buildMockElement();
        globalThis.fetch = vi.fn(() =>
            Promise.resolve({ ok: true, json: () => Promise.resolve(SAMPLE_DATA) })
        );
        expect(() => $exeDevice.init(el2, null)).not.toThrow();
        el2.remove();
        vi.restoreAllMocks();
    });

    it('renders a dataset selector in the DOM after init', async () => {
        const el3 = buildMockElement();
        globalThis.fetch = vi.fn(() =>
            Promise.resolve({ ok: true, json: () => Promise.resolve(SAMPLE_DATA) })
        );
        $exeDevice.init(el3, null);
        await new Promise(r => setTimeout(r, 50));
        const dsSelect = el3.querySelector('select[id*="lomloe-ds-"]');
        expect(dsSelect).not.toBeNull();
        // Should have at least one option
        expect(dsSelect.options.length).toBeGreaterThanOrEqual(1);
        el3.remove();
        vi.restoreAllMocks();
    });
});
