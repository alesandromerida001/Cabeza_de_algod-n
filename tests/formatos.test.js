const test=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const F=require('../frontend/compartido/formatos');
test('fechas visibles en español, meses completos y entradas ambiguas rechazadas',()=>{
    assert.equal(F.fecha('2026-10-09'),'09/oct/2026');
    assert.equal(F.fecha('2026-01-01'),'01/ene/2026');
    assert.equal(F.fecha('2026-12-25'),'25/dic/2026');
    assert.equal(F.fecha('2024-02-29'),'29/feb/2024');
    for(const v of ['09/10/2026','2026-02-29','2026-13-01','texto',null,'2026-10-09 basura'])assert.equal(F.fecha(v),'No registrado');
    assert.equal(F.periodo('2026-10'),'octubre 2026');assert.equal(F.dinero(1250.5),'Q 1,250.50');assert.equal(F.hora('14:45'),'02:45 PM');
});
test('DATE serializado no retrocede de día; auditoría UTC sí usa Guatemala',()=>{
    assert.equal(F.fecha('2026-10-09T00:00:00.000Z'),'09/oct/2026');
    assert.equal(F.fecha(new Date('2026-10-09T00:00:00Z')),'09/oct/2026');
    assert.equal(F.fecha('2026-10-09T00:00:00.000Z',true),'08/oct/2026');
    assert.equal(F.fecha('2026-10-09T06:00:00.000Z',true),'09/oct/2026');
    assert.equal(F.fecha('2026-10-09',true),'No registrado');
    assert.equal(F.dia('2026-10-09T00:00:00.000Z'),'2026-10-09');
});
test('formato DATE independiente de zona horaria del host; ISO intacto para formularios',()=>{
    for(const TZ of ['UTC','America/Guatemala','Asia/Tokyo']){
        const r=spawnSync(process.execPath,['-e',`const F=require('./frontend/compartido/formatos');console.log(F.fecha('2026-01-01T00:00:00.000Z')+'|'+F.dia('2026-01-01T00:00:00.000Z'))`],{cwd:require('node:path').resolve(__dirname,'..'),env:{...process.env,TZ},encoding:'utf8'});
        assert.equal(r.status,0);assert.equal(r.stdout.trim(),'01/ene/2026|2026-01-01');
    }
});
