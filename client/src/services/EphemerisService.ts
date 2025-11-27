
/**
 * Service to handle Swiss Ephemeris calculations via WASM.
 * Uses 'swisseph-wasm' package.
 */

import { DateTime } from 'luxon';
import SwissEph from 'swisseph-wasm';
import { ChartData, HumanDesignLogic, Activation } from './HumanDesignLogic';
import { Center } from './HumanDesignDefinitions';

export class EphemerisService {
    private swe: any = null;

    constructor(_ephePath: string) {
        // ephePath reserved for future use
    }

    async initialize() {
        if (this.swe) {
            return;
        }

        try {
            console.log("Initializing Swiss Ephemeris...");
            const sweInstance = new SwissEph();
            await sweInstance.initSwissEph();
            this.swe = sweInstance;
            console.log("Swiss Ephemeris WASM Initialized");
        } catch (error) {
            // Ensure we don't keep a half-initialized instance around
            this.swe = null;
            console.error("Failed to initialize Swiss Ephemeris:", error);
            throw error;
        }
    }

    private getZodiacSign(longitude: number): string {
        const signs = [
            'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
            'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
        ];
        let index = Math.floor(longitude / 30);
        if (index < 0 || index > 11) {
            index = ((index % 12) + 12) % 12;
        }
        return signs[index];
    }

    formatDegrees(decimalDegrees: number): string {
        const inSignDegrees = decimalDegrees % 30;
        let degrees = Math.floor(inSignDegrees);

        const totalMinutes = (inSignDegrees - degrees) * 60;
        let minutes = Math.floor(totalMinutes);
        let seconds = Math.round((totalMinutes - minutes) * 60);

        if (seconds === 60) {
            seconds = 0;
            minutes++;
        }
        if (minutes === 60) {
            minutes = 0;
            degrees++;
        }

        return `${degrees}°${minutes.toString().padStart(2, '0')}'${seconds.toString().padStart(2, '0')}"`;
    }

    /**
     * Compute Asc / MC / related angles using high-level swe.houses_ex,
     * following the pattern from birth-chart.js / debug_houses.js.
     * Returns ascmc[0..3] (Asc, MC, ARMC, Vertex) or null on failure.
     */
    private calculateAsmc(jd: number, lat: number, lng: number): number[] | null {
        if (!this.swe || typeof this.swe.houses_ex !== 'function') return null;

        // Swiss Ephemeris expects longitude in degrees (east positive, west negative),
        // and jd in UT, which we already use.
        const cusps = new Array(13).fill(0);   // 1..12 used
        const ascmc = new Array(10).fill(0);   // 0: Asc, 1: MC, 2: ARMC, 3: Vertex
        const hsysCode = 'P'.charCodeAt(0);    // Placidus
        const iflag = 0;

        try {
            const ret = this.swe.houses_ex(jd, iflag, lat, lng, hsysCode, cusps, ascmc);
            if (ret < 0) return null;
            return [ascmc[0], ascmc[1], ascmc[2], ascmc[3]];
        } catch {
            return null;
        }
    }

    private calculatePlanet(jd: number, planetId: number): number {
        // Use SWIEPH for high precision (requires .se1 files loaded in initialize)
        // SEFLG_SPEED calculates speed, which improves position accuracy for fast movers like Moon
        const flag = this.swe.SEFLG_SWIEPH | this.swe.SEFLG_SPEED;
        const result = this.swe.calc_ut(jd, planetId, flag);
        return result[0]; // longitude
    }

    calculateDesignDate(birthUtc: DateTime, birthSunLongitude: number): { date: DateTime, jd: number } {
        let targetSun = birthSunLongitude - 88.0;
        if (targetSun < 0) targetSun += 360;

        let designDate = birthUtc.minus({ days: 88 });
        let jd = 0;
        
        for (let i = 0; i < 5; i++) {
            jd = this.swe.julday(designDate.year, designDate.month, designDate.day,
                designDate.hour + designDate.minute/60 + (designDate.second || 0)/3600);

            const currentSun = this.calculatePlanet(jd, this.swe.SE_SUN);
            
            let diff = targetSun - currentSun;
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;

            if (Math.abs(diff) < 0.0001) break;

            designDate = designDate.plus({ days: diff });
        }

        return { date: designDate, jd };
    }

    async getChartData(birthData: any): Promise<ChartData> {
        await this.initialize();
        
        const zone = birthData.timezone && typeof birthData.timezone === 'string' && birthData.timezone.trim() !== ''
            ? birthData.timezone.trim()
            : 'UTC';

        const localDateTime = DateTime.fromISO(`${birthData.date}T${birthData.time}`, { zone });
        if (!localDateTime.isValid) {
            console.error('Invalid local date/time in getChartData', {
                date: birthData.date,
                time: birthData.time,
                timezone: zone,
                reason: localDateTime.invalidReason,
                explanation: localDateTime.invalidExplanation,
            });
            throw new Error('Invalid date, time, or timezone. Unable to calculate chart.');
        }

        const utcDateTime = localDateTime.toUTC(); 
        
        // Parse coordinates for house calculation
        const latStr = birthData.lat || birthData.latitude || '0';
        const lngStr = birthData.lng || birthData.longitude || '0';
        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            console.error('Invalid latitude/longitude in getChartData', { latStr, lngStr });
            throw new Error('Invalid latitude or longitude. Unable to calculate chart.');
        }
        
        // 1. Birth JD
        const birthJd = this.swe.julday(utcDateTime.year, utcDateTime.month, utcDateTime.day,
            utcDateTime.hour + utcDateTime.minute/60 + (utcDateTime.second || 0)/3600);

        // 2. Calculate Ascendant for house calculation
        const birthAsmc = this.calculateAsmc(birthJd, lat, lng);
        const ascLong = birthAsmc ? birthAsmc[0] : null;
        
        // Helper: Whole Sign House Calculation
        const getWholeSignHouse = (planetLong: number, asc: number | null): number | undefined => {
            if (asc === null) return undefined;
            const ascSign = Math.floor(asc / 30);
            const planetSign = Math.floor(planetLong / 30);
            return ((planetSign - ascSign + 12) % 12) + 1;
        };

        // 3. Calculate Birth Planets
        const planetIds = [
            { id: this.swe.SE_SUN, name: 'Sun' },
            { id: this.swe.SE_MOON, name: 'Moon' },
            { id: this.swe.SE_TRUE_NODE, name: 'NorthNode' }, 
            { id: this.swe.SE_MERCURY, name: 'Mercury' },
            { id: this.swe.SE_VENUS, name: 'Venus' },
            { id: this.swe.SE_MARS, name: 'Mars' },
            { id: this.swe.SE_JUPITER, name: 'Jupiter' },
            { id: this.swe.SE_SATURN, name: 'Saturn' },
            { id: this.swe.SE_URANUS, name: 'Uranus' },
            { id: this.swe.SE_NEPTUNE, name: 'Neptune' },
            { id: this.swe.SE_PLUTO, name: 'Pluto' },
            { id: this.swe.SE_CHIRON, name: 'Chiron' },
            { id: this.swe.SE_MEAN_APOG, name: 'Black Moon Lilith' },
        ];

        const birthActivations: Record<string, Activation> = {};

        planetIds.forEach(p => {
            const long = this.calculatePlanet(birthJd, p.id);
            const activation = HumanDesignLogic.calculateActivation(long);
            activation.house = getWholeSignHouse(long, ascLong);
            birthActivations[p.name] = activation;
        });

        // Add Earth (Opposite Sun)
        const birthSunLong = birthActivations['Sun'].longitude;
        const birthEarthLong = (birthSunLong + 180) % 360;
        const earthActivation = HumanDesignLogic.calculateActivation(birthEarthLong);
        earthActivation.house = getWholeSignHouse(birthEarthLong, ascLong);
        birthActivations['Earth'] = earthActivation;

        // Add South Node (Opposite North Node)
        const birthNnLong = birthActivations['NorthNode'].longitude;
        const birthSnLong = (birthNnLong + 180) % 360;
        const snActivation = HumanDesignLogic.calculateActivation(birthSnLong);
        snActivation.house = getWholeSignHouse(birthSnLong, ascLong);
        birthActivations['SouthNode'] = snActivation;

        // 4. Design Date & JD
        const { jd: designJd } = this.calculateDesignDate(utcDateTime, birthSunLong);
        
        // 5. Calculate Design Ascendant for design houses
        const designAsmc = this.calculateAsmc(designJd, lat, lng);
        const designAscLong = designAsmc ? designAsmc[0] : null;
        
        // 6. Design Planets
        const designActivations: Record<string, Activation> = {};

        planetIds.forEach(p => {
            const long = this.calculatePlanet(designJd, p.id);
            const activation = HumanDesignLogic.calculateActivation(long);
            activation.house = getWholeSignHouse(long, designAscLong);
            designActivations[p.name] = activation;
        });

        // Design Earth
        const designSunLong = designActivations['Sun'].longitude;
        const designEarthLong = (designSunLong + 180) % 360;
        const designEarthActivation = HumanDesignLogic.calculateActivation(designEarthLong);
        designEarthActivation.house = getWholeSignHouse(designEarthLong, designAscLong);
        designActivations['Earth'] = designEarthActivation;

        // Design South Node
        const designNnLong = designActivations['NorthNode'].longitude;
        const designSnLong = (designNnLong + 180) % 360;
        const designSnActivation = HumanDesignLogic.calculateActivation(designSnLong);
        designSnActivation.house = getWholeSignHouse(designSnLong, designAscLong);
        designActivations['SouthNode'] = designSnActivation;

        // 7. Human Design Properties
        return HumanDesignLogic.determineChartProperties(birthActivations, designActivations);
    }

    async calculateChart(birthData: any): Promise<string> {
        await this.initialize();
        
        const zone = birthData.timezone && typeof birthData.timezone === 'string' && birthData.timezone.trim() !== ''
            ? birthData.timezone.trim()
            : 'UTC';

        const localDateTime = DateTime.fromISO(`${birthData.date}T${birthData.time}`, { zone });
        if (!localDateTime.isValid) {
            console.error('Invalid local date/time in calculateChart', {
                date: birthData.date,
                time: birthData.time,
                timezone: zone,
                reason: localDateTime.invalidReason,
                explanation: localDateTime.invalidExplanation,
            });
            throw new Error('Invalid date, time, or timezone. Please check your input.');
        }

        const utcDateTime = localDateTime.toUTC(); 
        
        // Parse Coordinates
        // Handle both lat/lng and latitude/longitude property names
        const latStr = birthData.lat || birthData.latitude || '0';
        const lngStr = birthData.lng || birthData.longitude || '0';
        
        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            console.error('Invalid latitude/longitude in calculateChart', { latStr, lngStr });
            throw new Error('Invalid latitude or longitude. Please check your input.');
        }

        if (lat === 0 && lng === 0 && birthData.location && birthData.location.length > 10) {
            console.warn("Warning: Latitude and Longitude are 0.0. This might indicate a parsing error if the location is not actually Null Island.");
        }

        // 1. Birth JD
        const birthJd = this.swe.julday(utcDateTime.year, utcDateTime.month, utcDateTime.day,
            utcDateTime.hour + utcDateTime.minute/60 + (utcDateTime.second || 0)/3600);

        // 2. Calculate Cross Points (Asc, MC, etc.) using Placidus system via swe_houses_ex2
        const birthAsmc = this.calculateAsmc(birthJd, lat, lng);

        // 3. Calculate Birth Planets
        const planetIds = [
            { id: this.swe.SE_SUN, name: 'Sun' },
            { id: this.swe.SE_MOON, name: 'Moon' },
            { id: this.swe.SE_TRUE_NODE, name: 'NorthNode' }, 
            { id: this.swe.SE_MERCURY, name: 'Mercury' },
            { id: this.swe.SE_VENUS, name: 'Venus' },
            { id: this.swe.SE_MARS, name: 'Mars' },
            { id: this.swe.SE_JUPITER, name: 'Jupiter' },
            { id: this.swe.SE_SATURN, name: 'Saturn' },
            { id: this.swe.SE_URANUS, name: 'Uranus' },
            { id: this.swe.SE_NEPTUNE, name: 'Neptune' },
            { id: this.swe.SE_PLUTO, name: 'Pluto' },
            { id: this.swe.SE_CHIRON, name: 'Chiron' },
            { id: this.swe.SE_MEAN_APOG, name: 'Black Moon Lilith' },
        ];

        const birthActivations: Record<string, Activation> = {};

        planetIds.forEach(p => {
            const long = this.calculatePlanet(birthJd, p.id);
            birthActivations[p.name] = HumanDesignLogic.calculateActivation(long);
        });

        // Add Earth (Opposite Sun)
        const birthSunLong = birthActivations['Sun'].longitude;
        const birthEarthLong = (birthSunLong + 180) % 360;
        birthActivations['Earth'] = HumanDesignLogic.calculateActivation(birthEarthLong);

        // Add South Node (Opposite North Node)
        const birthNnLong = birthActivations['NorthNode'].longitude;
        const birthSnLong = (birthNnLong + 180) % 360;
        birthActivations['SouthNode'] = HumanDesignLogic.calculateActivation(birthSnLong);

        // 4. Design Date & JD
        const { date: designDate, jd: designJd } = this.calculateDesignDate(utcDateTime, birthSunLong);
        
        // 5. Design Cross Points (Asc, MC, etc.)
        const designAsmc = this.calculateAsmc(designJd, lat, lng);

        // 6. Design Planets
        const designActivations: Record<string, Activation> = {};

        planetIds.forEach(p => {
            const long = this.calculatePlanet(designJd, p.id);
            designActivations[p.name] = HumanDesignLogic.calculateActivation(long);
        });

        // Design Earth
        const designSunLong = designActivations['Sun'].longitude;
        const designEarthLong = (designSunLong + 180) % 360;
        designActivations['Earth'] = HumanDesignLogic.calculateActivation(designEarthLong);

        // Design South Node
        const designNnLong = designActivations['NorthNode'].longitude;
        const designSnLong = (designNnLong + 180) % 360;
        designActivations['SouthNode'] = HumanDesignLogic.calculateActivation(designSnLong);

        // 7. Human Design Properties
        const chartData = HumanDesignLogic.determineChartProperties(birthActivations, designActivations);


        // --- GENERATE REPORT ---
        
        let output = `Human Design Birth Chart Analysis\n-------------------------------\n`;
        output += `Name: ${birthData.name}\n`;
        output += `Birth Date (Local): ${localDateTime.toFormat('M/d/yyyy HH:mm:ss')}\n`;
        output += `Design Date (UTC): ${designDate.toFormat('M/d/yyyy h:mm a')}\n`; 
        output += `Location: ${birthData.location || 'Unknown'}\n`;
        output += `Coordinates: ${lat.toFixed(2)}°, ${lng.toFixed(2)}°\n\n`;

        // Helper: Whole Sign House Calculation
        const getWholeSignHouse = (planetLong: number, ascLong: number) => {
            const ascSign = Math.floor(ascLong / 30);
            const planetSign = Math.floor(planetLong / 30);
            // Calculate distance in signs from Ascendant sign
            // (PlanetSign - AscSign + 12) % 12 gives 0-11 index. Add 1 for 1-12 house.
            return ((planetSign - ascSign + 12) % 12) + 1;
        };

        const printPlanets = (activations: Record<string, Activation>, ascLong: number | null) => {
            const order = [
                'Sun', 'Earth', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 
                'Saturn', 'Uranus', 'Neptune', 'Pluto', 'NorthNode', 'SouthNode', 
                'Chiron', 'Black Moon Lilith'
            ];
            let str = '';
            order.forEach(name => {
                const act = activations[name];
                const sign = this.getZodiacSign(act.longitude);
                let line = `${name}: ${act.gate}.${act.line}, ${sign} ${this.formatDegrees(act.longitude)}`;
                
                if (ascLong !== null) {
                    const house = getWholeSignHouse(act.longitude, ascLong);
                    line += `, House ${house}`;
                }
                str += line + '\n';
            });
            return str;
        };

        output += `Birth Chart Planetary Positions:\n\n`;
        // Use Birth Ascendant for Birth Planets
        output += printPlanets(birthActivations, birthAsmc ? birthAsmc[0] : null);

        const printCrossPoints = (asmc: number[] | null) => {
            if (!asmc || asmc.length < 4) {
                return 'Cross points unavailable (houses data not available).\n';
            }

            const asc = asmc[0];
            const mc = asmc[1];
            const vertex = asmc[3];
            const ic = (mc + 180) % 360;
            const desc = (asc + 180) % 360;

            const points = [
                { name: 'Ascendant', long: asc },
                { name: 'Midheaven', long: mc }, // MC is cusp of 10th house (Placidus)
                { name: 'Imum Coeli', long: ic }, // IC is cusp of 4th
                { name: 'Descendant', long: desc }, // Desc is cusp of 7th
                { name: 'Vertex', long: vertex } 
            ];

            let str = '';
            points.forEach(p => {
                const act = HumanDesignLogic.calculateActivation(p.long);
                const sign = this.getZodiacSign(p.long);
                let line = `${p.name}: ${act.gate}.${act.line}, ${sign} ${this.formatDegrees(p.long)}`;
                
                // Add House for Cross Points
                const house = getWholeSignHouse(p.long, asc);
                line += `, House ${house}`;
                
                str += line + '\n';
            });
            return str;
        };

        output += `\nBirth Chart Cross Points:\n`;
        output += printCrossPoints(birthAsmc);

        output += `\nDesign Chart Planetary Positions:\n\n`;
        // Use Design Ascendant for Design Planets (Standalone Design Chart logic)
        output += printPlanets(designActivations, designAsmc ? designAsmc[0] : null);

        output += `\nDesign Chart Cross Points:\n`;
        output += printCrossPoints(designAsmc);

        output += `\nHuman Design Core Information:\n`;
        output += `Type: ${chartData.type}\n`;
        output += `Strategy: ${chartData.authority}\n`; 
        output += `Definition: ${chartData.definition}\n`; 
        output += `Profile: ${chartData.profile}\n`;
        output += `Incarnation Cross: ${chartData.incarnationCross}\n`;

        output += `\nDefined/Undefined Centers:\n`;
        const centerOrder = [
            Center.Root, Center.Sacral, Center.Emotions, Center.Spleen, 
            Center.Heart, Center.Self, Center.Throat, Center.Mind, Center.Crown
        ];
        
        const centerNameMap: Record<string, string> = {
            [Center.Root]: 'Root',
            [Center.Sacral]: 'Sacral',
            [Center.Emotions]: 'Emotions',
            [Center.Spleen]: 'Spleen',
            [Center.Heart]: 'Ego/Willpower',
            [Center.Self]: 'G-Center/Heart',
            [Center.Throat]: 'Throat',
            [Center.Mind]: 'Mind',
            [Center.Crown]: 'Crown'
        };

        centerOrder.forEach(c => {
            const status = chartData.definedCenters.has(c) ? 'Defined' : 'Undefined';
            output += `${centerNameMap[c]}: ${status}\n`;
        });

        output += `\nVariables:\n`;
        const vars = chartData.variables;
        output += `Digestion: ${vars.digestion.orientation}, Color ${vars.digestion.color}-Tone ${vars.digestion.tone}\n`;
        output += `Environment: ${vars.environment.orientation}, Color ${vars.environment.color}-Tone ${vars.environment.tone}\n`;
        output += `Awareness: ${vars.awareness.orientation}, Color ${vars.awareness.color}-Tone ${vars.awareness.tone}\n`;
        output += `Perspective: ${vars.perspective.orientation}, Color ${vars.perspective.color}-Tone ${vars.perspective.tone}\n`;

        output += `\nDestiny Map:\n`;
        
        const hdPlanetOrder = [
            'Sun', 'Earth', 'NorthNode', 'SouthNode', 'Moon', 'Mercury',
            'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'
        ];

        const findHighestActivation = (acts: Record<string, Activation>): { name: string; act: Activation } | null => {
            let bestName: string | null = null;
            let bestAct: Activation | null = null;
            hdPlanetOrder.forEach(name => {
                const act = acts[name];
                if (!act) return;
                if (name === 'Chiron' || name === 'Black Moon Lilith') return;

                // Compare degree within sign (0–29.xx), not raw longitude.
                const inSign = ((act.longitude % 30) + 30) % 30;
                const bestInSign = bestAct ? ((bestAct.longitude % 30) + 30) % 30 : null;
                if (!bestAct || inSign > (bestInSign as number)) {
                    bestAct = act;
                    bestName = name;
                }
            });
            return bestName && bestAct ? { name: bestName, act: bestAct } : null;
        };

        const highestPersonality = findHighestActivation(birthActivations);
        const highestDesign = findHighestActivation(designActivations);

        if (highestPersonality) {
            const act = highestPersonality.act;
            const sign = this.getZodiacSign(act.longitude);
            output += `Life Purpose (${highestPersonality.name}): ${act.gate}.${act.line}, ${sign} ${this.formatDegrees(act.longitude)}\n`;
        }
        if (highestDesign) {
            const act = highestDesign.act;
            const sign = this.getZodiacSign(act.longitude);
            output += `Soul Purpose (${highestDesign.name}): ${act.gate}.${act.line}, ${sign} ${this.formatDegrees(act.longitude)}\n`;
        }

        output += `\nActive Channels:\n`;
        if (chartData.activeChannels.length === 0) {
            output += `None\n`;
        } else {
            chartData.activeChannels.forEach(ch => {
                output += `Channel ${ch}\n`;
            });
        }

        return output;
    }
}
