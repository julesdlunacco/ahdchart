
const fs = require('fs');
const path = require('path');

const content = `import { Center, Channels, GateToCenter, Profile, Strategy, Type } from './HumanDesignDefinitions';

// Constants for HD Calculations
const HD_OFFSET_TO_ZODIAC = 3.875;
const DEGREE_PER_GATE = 5.625;
const DEGREE_PER_LINE = 0.9375;
const DEGREE_PER_COLOR = 0.15625;
const DEGREE_PER_TONE = DEGREE_PER_COLOR / 6;
const DEGREE_PER_BASE = DEGREE_PER_TONE / 5;

export interface Activation {
    gate: number;
    line: number;
    color: number;
    tone: number;
    base: number;
    longitude: number;
}

export interface ChartData {
    activations: Record<string, Activation>; // Key is planet name
    activeGates: Set<number>;
    activeChannels: string[];
    definedCenters: Set<Center>;
    type: Type;
    authority: Strategy; // Using Strategy enum for Authority as per C#
    profile: Profile;
    variables: {
        digestion: VariableInfo;
        environment: VariableInfo;
        awareness: VariableInfo;
        perspective: VariableInfo;
    };
    incarnationCross: string;
}

interface VariableInfo {
    orientation: 'Left' | 'Right';
    color: number;
    tone: number;
    base: number;
}

export class HumanDesignLogic {

    static calculateActivation(longitude: number): Activation {
        let adjustedDegrees = longitude - HD_OFFSET_TO_ZODIAC;
        if (adjustedDegrees < 0) {
            adjustedDegrees += 360;
        }

        // Wheel Order derived from C# Gates enum mapping
        const wheelOrder = [
            17, 21, 51, 42, 3, 27, 24, 2, 23, 8, 
            20, 16, 35, 45, 12, 15, 52, 39, 53, 62,
            56, 31, 33, 7, 4, 29, 59, 40, 64, 47,
            6, 46, 18, 48, 57, 32, 50, 28, 44, 1,
            43, 14, 34, 9, 5, 26, 11, 10, 58, 38,
            54, 61, 60, 41, 19, 13, 49, 30, 55, 37,
            63, 22, 36, 25
        ];

        const index = Math.floor(adjustedDegrees / DEGREE_PER_GATE);
        const gate = wheelOrder[index] || 1;

        const remainderForLine = adjustedDegrees % DEGREE_PER_GATE;
        const line = Math.floor(remainderForLine / DEGREE_PER_LINE) + 1;

        const remainderForColor = remainderForLine % DEGREE_PER_LINE;
        const color = Math.floor(remainderForColor / DEGREE_PER_COLOR) + 1;

        const remainderForTone = remainderForColor % DEGREE_PER_COLOR;
        const tone = Math.floor(remainderForTone / DEGREE_PER_TONE) + 1;

        const remainderForBase = remainderForTone % DEGREE_PER_TONE;
        const base = Math.floor(remainderForBase / DEGREE_PER_BASE) + 1;

        return { gate, line, color, tone, base, longitude };
    }

    static determineChartProperties(personalityActivations: Record<string, Activation>, designActivations: Record<string, Activation>): ChartData {
         const activeGates = new Set<number>();
         Object.values(personalityActivations).forEach(a => activeGates.add(a.gate));
         Object.values(designActivations).forEach(a => activeGates.add(a.gate));
 
         const activeChannels: string[] = [];
         const adjacency: Record<string, string[]> = {}; // Center -> Connected Centers

         Channels.forEach(channel => {
             if (activeGates.has(channel.gates[0]) && activeGates.has(channel.gates[1])) {
                 activeChannels.push(channel.id);
                 
                 const c1 = GateToCenter[channel.gates[0]];
                 const c2 = GateToCenter[channel.gates[1]];
                 
                 if (!adjacency[c1]) adjacency[c1] = [];
                 if (!adjacency[c2]) adjacency[c2] = [];
                 adjacency[c1].push(c2);
                 adjacency[c2].push(c1);
             }
         });
         
         const definedCenters = new Set<Center>();
         activeChannels.forEach(cid => {
             const c = Channels.find(x => x.id === cid);
             if(c) {
                const c1 = GateToCenter[c.gates[0]];
                const c2 = GateToCenter[c.gates[1]];
                if (c1) definedCenters.add(c1);
                if (c2) definedCenters.add(c2);
             }
         });

         const isConnected = (start: Center, end: Center): boolean => {
             if (!definedCenters.has(start) || !definedCenters.has(end)) return false;
             if (start === end) return true;
             
             const visited = new Set<string>();
             const queue = [start];
             visited.add(start);
             
             while(queue.length > 0) {
                 const curr = queue.shift()!;
                 if (curr === end) return true;
                 
                 const neighbors = adjacency[curr] || [];
                 for(const n of neighbors) {
                     if(!visited.has(n)) {
                         visited.add(n);
                         // @ts-ignore - Enum/String matching
                         queue.push(n);
                     }
                 }
             }
             return false;
         };

         // Type Logic
         let type = Type.Reflector;
         if (definedCenters.size > 0) {
             const sacral = definedCenters.has(Center.Sacral);
             const throat = definedCenters.has(Center.Throat);
             
             const motors = [Center.Sacral, Center.Heart, Center.Emotions, Center.Root];
             let anyMotorToThroat = false;
             
             if (throat) {
                 for (const m of motors) {
                     if (definedCenters.has(m) && isConnected(m, Center.Throat)) {
                         anyMotorToThroat = true;
                         break;
                     }
                 }
             }

             if (sacral) {
                 type = anyMotorToThroat ? Type.ManifestingGenerator : Type.Generator;
             } else {
                 type = anyMotorToThroat ? Type.Manifestor : Type.Projector;
             }
         }
         
         // Authority Logic
         let authority = Strategy.Outer;
         if (definedCenters.has(Center.Emotions)) authority = Strategy.Emotional;
         else if (definedCenters.has(Center.Sacral)) authority = Strategy.Sacral;
         else if (definedCenters.has(Center.Spleen)) authority = Strategy.Spleen;
         else if (definedCenters.has(Center.Heart)) {
             authority = Strategy.Heart; 
         }
         else if (definedCenters.has(Center.Self)) authority = Strategy.Self;
         else if (definedCenters.has(Center.Mind) || definedCenters.has(Center.Crown)) authority = Strategy.Mental; 
         else authority = Strategy.Outer;

         // Profile
         const pSun = personalityActivations['Sun'];
         const dSun = designActivations['Sun'];
         const profile = this.determineProfile(pSun.line, dSun.line);

         // Variables
         const variables = this.determineVariables(personalityActivations, designActivations);
         
         // Incarnation Cross
         const incarnationCross = \`The Right Angle Cross of the Unexpected \${pSun.line}\`; 

         return {
             activations: personalityActivations,
             activeGates,
             activeChannels,
             definedCenters,
             type,
             authority,
             profile,
             variables,
             incarnationCross
         };
    }

    private static determineProfile(pLine: number, dLine: number): Profile {
        const tag = \`\${pLine}/\${dLine}\`;
        switch (tag) {
            case '1/3': return Profile.P1_3;
            case '1/4': return Profile.P1_4;
            case '2/4': return Profile.P2_4;
            case '2/5': return Profile.P2_5;
            case '3/5': return Profile.P3_5;
            case '3/6': return Profile.P3_6;
            case '4/6': return Profile.P4_6;
            case '4/1': return Profile.P4_1;
            case '5/1': return Profile.P5_1;
            case '5/2': return Profile.P5_2;
            case '6/2': return Profile.P6_2;
            case '6/3': return Profile.P6_3;
            default: return Profile.P1_3; // Fallback
        }
    }

    private static determineVariables(p: Record<string, Activation>, d: Record<string, Activation>) {
        const dSun = d['Sun'];
        const pSun = p['Sun'];
        const dNode = d['North Node'];
        const pNode = p['North Node'];
        
        const toOrientation = (tone: number) => tone <= 3 ? 'Left' : 'Right';

        return {
            digestion: {
                orientation: toOrientation(dSun.tone) as 'Left'|'Right',
                color: dSun.color,
                tone: dSun.tone,
                base: dSun.base
            },
            environment: {
                orientation: toOrientation(dNode.tone) as 'Left'|'Right',
                color: dNode.color,
                tone: dNode.tone,
                base: dNode.base
            },
            perspective: {
                orientation: toOrientation(pSun.tone) as 'Left'|'Right',
                color: pSun.color,
                tone: pSun.tone,
                base: pSun.base
            },
            awareness: {
                orientation: toOrientation(pNode.tone) as 'Left'|'Right',
                color: pNode.color,
                tone: pNode.tone,
                base: pNode.base
            }
        };
    }
}
`;

const filePath = path.join(__dirname, 'src', 'services', 'HumanDesignLogic.ts');
fs.writeFileSync(filePath, content, 'utf8');
console.log('Wrote HumanDesignLogic.ts');
