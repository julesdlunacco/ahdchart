
import SwissEph from 'swisseph-wasm';

async function run() {
    const swe = new SwissEph();
    await swe.initSwissEph();
    
    console.log("Keys of swe:", Object.keys(swe));
    console.log("Prototype keys:", Object.getOwnPropertyNames(Object.getPrototypeOf(swe)));
}
run();
