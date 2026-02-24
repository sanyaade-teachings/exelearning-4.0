/* global _ */
/**
 * LOMLOE Curriculum Concretion iDevice — Export Renderer
 *
 * Called during export to convert stored JSON data into rendered HTML.
 * The `$Lomloe` object name matches the `export-object` in config.xml.
 *
 * @license AGPL-3.0-or-later
 */
var $Lomloe = {
    ideviceClass: 'lomloeIdeviceContent',

    // Coverage label map (language-neutral keys, Spanish display)
    COVERAGE_LABELS: {
        '': '',
        introduced: 'Introducido',
        practiced: 'Practicado',
        assessed: 'Evaluado'
    },

    COVERAGE_CLASSES: {
        introduced: 'lomloe-coverage-introduced',
        practiced: 'lomloe-coverage-practiced',
        assessed: 'lomloe-coverage-assessed'
    },

    /** Display names for each competencia clave code (used as tooltip title). */
    CC_DESCRIPTIONS: {
        'CCL':    'Competencia en comunicación lingüística',
        'CCL1':   'CCL1 — Expresa e interpreta conceptos, pensamientos, hechos y opiniones de forma oral, escrita o signada',
        'CCL2':   'CCL2 — Comprende e interpreta con sentido crítico textos orales, escritos o multimodales',
        'CCL3':   'CCL3 — Localiza, selecciona y contrasta información de distintas fuentes evaluando su fiabilidad',
        'CCL4':   'CCL4 — Lee con fluidez y comprende textos de distinta naturaleza y complejidad',
        'CCL5':   'CCL5 — Produce textos con corrección lingüística, adecuación y coherencia',
        'CP':     'Competencia plurilingüe',
        'CP1':    'CP1 — Usa al menos una lengua adicional de forma eficiente en situaciones cotidianas',
        'CP2':    'CP2 — Media en situaciones cotidianas que requieren comunicarse en distintas lenguas',
        'CP3':    'CP3 — Conoce y respeta la diversidad lingüística y cultural como valor de las sociedades',
        'STEM':   'Competencia matemática y en ciencia, tecnología e ingeniería',
        'STEM1':  'STEM1 — Utiliza conceptos y razonamientos matemáticos para interpretar y producir información',
        'STEM2':  'STEM2 — Aplica métodos del razonamiento científico para analizar situaciones y resolver problemas',
        'STEM3':  'STEM3 — Plantea proyectos de diseño, creando prototipos o modelos para resolver problemas',
        'STEM4':  'STEM4 — Interpreta y transmite elementos relevantes de investigaciones de forma clara y precisa',
        'STEM5':  'STEM5 — Desarrolla proyectos de diseño de forma creativa, evaluando su sostenibilidad e impacto',
        'CD':     'Competencia digital',
        'CD1':    'CD1 — Realiza búsquedas en internet y contrasta información de forma crítica',
        'CD2':    'CD2 — Crea, integra y reelabora contenidos digitales respetando los derechos de autoría',
        'CD3':    'CD3 — Protege dispositivos, datos personales y privacidad en entornos digitales',
        'CD4':    'CD4 — Conoce los riesgos en entornos digitales y adopta medidas de seguridad',
        'CD5':    'CD5 — Desarrolla soluciones tecnológicas innovadoras para dar respuesta a necesidades',
        'CPSAA':    'Competencia personal, social y de aprender a aprender',
        'CPSAA1':   'CPSAA1 — Regula las emociones afrontando los retos y cambios con optimismo y resiliencia',
        'CPSAA1.1': 'CPSAA1.1 — Fortalece el optimismo, la resiliencia, la autoeficacia y la búsqueda de objetivos',
        'CPSAA1.2': 'CPSAA1.2 — Desarrolla una adecuada autoestima valorando las fortalezas y aceptando los límites',
        'CPSAA2':   'CPSAA2 — Comprende la perspectiva de otros y se relaciona con empatía y asertividad',
        'CPSAA3':   'CPSAA3 — Muestra proactividad y autonomía en la gestión del aprendizaje',
        'CPSAA3.1': 'CPSAA3.1 — Evalúa y reflexiona sobre sus procesos de aprendizaje para mejorarlos',
        'CPSAA3.2': 'CPSAA3.2 — Desarrolla autodirección y control del proceso de aprendizaje individual',
        'CPSAA4':   'CPSAA4 — Desarrolla habilidades de colaboración participando activa y responsablemente',
        'CPSAA5':   'CPSAA5 — Planifica objetivos a largo plazo evaluando progresos y ajustando estrategias',
        'CC':    'Competencia ciudadana',
        'CC1':   'CC1 — Interpreta y comprende la realidad histórica, social y política del mundo',
        'CC2':   'CC2 — Comprende y analiza problemas éticos fundamentales y de actualidad',
        'CC3':   'CC3 — Aplica estrategias de análisis sistemático y crítico de la información',
        'CC4':   'CC4 — Comprende las diferentes realidades de un mundo global e interdependiente',
        'CE':    'Competencia emprendedora',
        'CE1':   'CE1 — Analiza necesidades y oportunidades afrontando retos con sentido crítico y ético',
        'CE2':   'CE2 — Evalúa las fortalezas y debilidades propias con vistas al emprendimiento',
        'CE3':   'CE3 — Desarrolla un proyecto emprendedor individual o colectivo buscando cooperación',
        'CE7':   'CE7 — Desarrolla ideas innovadoras y creativas con valor para la sociedad',
        'CCEC':    'Competencia en conciencia y expresión culturales',
        'CCEC1':   'CCEC1 — Conoce, aprecia críticamente y respeta el patrimonio cultural y artístico',
        'CCEC2':   'CCEC2 — Disfruta, respeta y valora críticamente las manifestaciones culturales y artísticas',
        'CCEC3':   'CCEC3 — Expresa ideas, sentimientos y emociones por medio de producciones culturales y artísticas',
        'CCEC3.1': 'CCEC3.1 — Desarrolla la creatividad y el sentido estético para enriquecer la comunicación',
        'CCEC3.2': 'CCEC3.2 — Respeta e interpreta el patrimonio cultural y artístico en su contexto sociohistórico',
        'CCEC4':   'CCEC4 — Define e implementa acciones de responsabilidad cultural y artística',
        'CCEC4.1': 'CCEC4.1 — Conoce y aplica los derechos de autoría y respeta la propiedad intelectual',
        'CCEC4.2': 'CCEC4.2 — Participa de forma comprometida y creativa en proyectos culturales y artísticos'
    },

    /** ISO 3166-2:ES code → human-readable label */
    DATASET_LABELS: {
        'ES':    'Estado (España)',
        'ES-AN': 'Andalucía',
        'ES-AR': 'Aragón',
        'ES-AS': 'Asturias, Principado de',
        'ES-CB': 'Cantabria',
        'ES-CL': 'Castilla y León',
        'ES-CM': 'Castilla-La Mancha',
        'ES-CN': 'Canarias',
        'ES-CT': 'Catalunya',
        'ES-EX': 'Extremadura',
        'ES-GA': 'Galicia',
        'ES-IB': 'Illes Balears',
        'ES-MD': 'Comunidad de Madrid',
        'ES-MC': 'Región de Murcia',
        'ES-NC': 'Comunidad Foral de Navarra',
        'ES-PV': 'País Vasco / Euskadi',
        'ES-RI': 'La Rioja',
        'ES-VC': 'Comunitat Valenciana'
    },

    /** Called once on page load. No-op for this iDevice. */
    init: function (data, accessibility) {},

    /** Called to render the iDevice view into the template. */
    renderView: function (data, accessibility, template, ideviceId, pathMedia) {
        var html = this.getHTMLView(data, pathMedia);
        return template.replace('{content}', html);
    },

    /** Generates the complete HTML for the exported view. */
    getHTMLView: function (data, pathMedia) {
        var selections = data.lomloeSelections || [];
        var datasetId = data.lomloeDataset || 'canarias';
        var summaryHtml = data.lomloeSummaryHtml || '';

        // Use pre-rendered HTML if available (generated by editor on save)
        if (summaryHtml) {
            return summaryHtml;
        }

        // Fallback: render from selections array
        return this._buildSummaryFromSelections(selections, datasetId);
    },

    /** Builds summary HTML from selections array (fallback when pre-rendered not available). */
    _buildSummaryFromSelections: function (selections, datasetId) {
        if (!selections || selections.length === 0) {
            return '<p class="lomloe-export-empty">No hay elementos curriculares seleccionados.</p>';
        }

        var datasetLabel = this.DATASET_LABELS[datasetId] || datasetId;
        var sabers = selections.filter(function (s) { return s.type === 'saber'; });
        var criterios = selections.filter(function (s) { return s.type === 'criterio'; });

        var html = '';
        html += '<h3 class="lomloe-export-title">Fundamentación Curricular LOMLOE</h3>';
        html += '<p class="lomloe-export-meta">';
        html += 'Fundamentación: <strong>' + this._esc(datasetLabel) + '</strong>';
        html += ' &nbsp;|&nbsp; Elementos seleccionados: <strong>' + selections.length + '</strong>';
        if (sabers.length) html += ' &nbsp;(' + sabers.length + ' saberes básicos';
        if (criterios.length) html += ', ' + criterios.length + ' criterios de evaluación)';
        else if (sabers.length) html += ')';
        html += '</p>';

        html += this._buildTable(selections);
        return html;
    },

    /** Builds the summary table HTML. */
    _buildTable: function (selections) {
        if (!selections.length) return '';

        var html = '<table class="lomloe-export-table exe-table">';
        html += '<thead><tr>';
        html += '<th>Tipo</th>';
        html += '<th>Etapa</th>';
        html += '<th>Nivel</th>';
        html += '<th>Materia</th>';
        html += '<th>Código</th>';
        html += '<th>Descripción</th>';
        html += '<th>Comp. Clave</th>';
        html += '<th>Cobertura</th>';
        html += '<th>Notas</th>';
        html += '</tr></thead><tbody>';

        var self = this;
        selections.forEach(function (sel) {
            html += '<tr>';

            if (sel.type === 'saber') {
                html += '<td><span class="lomloe-type-badge lomloe-type-saber">Saber</span></td>';
                html += '<td>' + self._esc(sel.etapa) + '</td>';
                html += '<td>' + self._esc(sel.nivel) + '</td>';
                html += '<td>' + self._esc(sel.denominacion) + '</td>';
                html += '<td><code>' + self._esc(sel.nombre) + '</code></td>';
                html += '<td>';
                if (sel.subtitulo1) html += '<strong>' + self._esc(sel.subtitulo1) + '</strong>';
                if (sel.subtitulo2) html += '<br><small>' + self._esc(sel.subtitulo2) + '</small>';
                html += '</td>';
                html += '<td>—</td>';
            } else {
                html += '<td><span class="lomloe-type-badge lomloe-type-criterio">Criterio</span></td>';
                html += '<td>' + self._esc(sel.etapa) + '</td>';
                html += '<td>' + self._esc(sel.nivel) + '</td>';
                html += '<td>' + self._esc(sel.denominacion) + '</td>';
                html += '<td><code>' + self._esc(sel.codigoCriterio) + '</code><br>';
                html += '<small>CE: ' + self._esc(sel.codigoComp) + '</small></td>';
                html += '<td>' + self._esc(sel.descripcionCriterio || '') + '</td>';
                html += '<td>';
                (sel.competenciasClave || []).forEach(function (cc) {
                    var title = self.CC_DESCRIPTIONS[cc] || cc;
                    html += '<span class="lomloe-cc-badge" title="' + self._esc(title) + '">' + self._esc(cc) + '</span>';
                });
                html += '</td>';
            }

            var coverage = sel.coverage || '';
            var coverageLabel = self.COVERAGE_LABELS[coverage] || '';
            var coverageClass = self.COVERAGE_CLASSES[coverage] || '';
            html += '<td>';
            if (coverageLabel) {
                html += '<span class="lomloe-coverage-badge ' + coverageClass + '">' + self._esc(coverageLabel) + '</span>';
            } else {
                html += '—';
            }
            html += '</td>';
            html += '<td>' + self._esc(sel.notes || '') + '</td>';
            html += '</tr>';
        });

        html += '</tbody></table>';
        return html;
    },

    /** HTML-escapes a string. */
    _esc: function (str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    },

    /** Called to add runtime behaviour (no-op for this iDevice). */
    renderBehaviour: function (data, accessibility, ideviceId) {}
};

// Alias for the framework's auto-generated export object key
// getIdeviceObjectKey() produces '$' + ideviceId (lowercase, hyphens removed)
// The framework checks window['$lomloe'], so we need this alias.
var $lomloe = $Lomloe; // eslint-disable-line no-unused-vars
