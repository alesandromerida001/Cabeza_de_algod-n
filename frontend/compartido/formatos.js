// Compartido por navegador y Node. DATE/fecha SQL civil conserva su día;
// solo timestamps realmente UTC (auditoría) se convierten a Guatemala.
(function (raiz, crear) {
    const formatos = crear();
    if (typeof module === 'object' && module.exports) module.exports = formatos;
    else raiz.Formatos = formatos;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const abreviaturas = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    function dia(valor) {
        if (valor instanceof Date) valor = Number.isFinite(valor.getTime()) ? valor.toISOString() : '';
        if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:$|T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$)/.test(valor)) return '';
        const d = valor.slice(0,10), fecha = new Date(d+'T00:00:00Z');
        return Number.isFinite(fecha.getTime()) && fecha.toISOString().slice(0,10) === d ? d : '';
    }
    function fecha(valor, instante = false) {
        let d = dia(valor);
        if (instante && d) {
            const iso = valor instanceof Date ? valor.toISOString() : valor;
            if (!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(iso) || !Number.isFinite(Date.parse(iso))) return 'No registrado';
            d = new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Guatemala'}).format(new Date(iso));
        }
        return d ? `${d.slice(8,10)}/${abreviaturas[Number(d.slice(5,7))-1]}/${d.slice(0,4)}` : 'No registrado';
    }
    function periodo(valor) {
        return typeof valor === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor) ? `${meses[Number(valor.slice(5))-1]} ${valor.slice(0,4)}` : 'No registrado';
    }
    function dinero(valor) {
        return valor == null || valor === '' || !Number.isFinite(Number(valor)) ? 'No registrado' : 'Q '+Number(valor).toLocaleString('es-GT',{minimumFractionDigits:2,maximumFractionDigits:2});
    }
    function hora(valor) {
        if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(valor || '')) return 'No registrado';
        const h=Number(valor.slice(0,2));return `${String(h%12||12).padStart(2,'0')}:${valor.slice(3)} ${h<12?'AM':'PM'}`;
    }
    return { dia, fecha, periodo, dinero, hora };
});
