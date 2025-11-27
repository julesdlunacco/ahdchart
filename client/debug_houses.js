
import SwissEph from 'swisseph-wasm';

async function run() {
    console.log("Initializing...");
    const swe = new SwissEph();
    await swe.initSwissEph();
    
    const jd = 2447462.625;
    const lat = 42.86;
    const lng = -76.98;
    const method = 'P'.charCodeAt(0);
    
    let cusps = [0,0,0,0,0,0,0,0,0,0,0,0,0];
    let ascmc = [0,0,0,0,0,0,0,0,0,0];
    const flag = 0;
    
    console.log(`Calling swe.houses_ex(jd=${jd}, flag=${flag}, lat=${lat}, lng=${lng}, method=${method}, cusps, ascmc)...`);
    try {
        const result = swe.houses_ex(jd, flag, lat, lng, method, cusps, ascmc);
        console.log("Result:", result);
        console.log("Cusps:", cusps);
        console.log("Ascmc:", ascmc);
        
        if (result && typeof result === 'object') {
             console.log("Result Object Keys:", Object.keys(result));
             if (result.cusps) console.log("Result.cusps:", result.cusps);
        }
    } catch (e) {
        console.error("Error calling swe.houses_ex:", e);
    }
}
run();
