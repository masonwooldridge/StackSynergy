import {isLandSlot,landAllocation} from '../shared/landAllocation';
import {expect,it} from 'vitest';
import type {Card} from '../shared/model';
import {basicManaTargets,landManaSources,manaDemand} from '../shared/basicMana';
const c=(name:string,mana_cost:string,type_line='Creature',extra:Partial<Card>={}):Card=>({id:name,name,mana_cost,type_line,...extra});
it('counts colored, explicit colorless and hybrid demand without treating generic as colorless',()=>{expect(manaDemand([{card:c('hybrid','{3}{W/U}{2/G}{B/P}{C}{X}'),qty:2}])).toEqual({W:1,U:1,G:1,B:2,C:2});expect(manaDemand([{card:c('generic','{8}'),qty:1}])).toEqual({});});
it('uses commander costs and asymmetric selected spell pips instead of equal identity shares',()=>{const entries=[{card:c('commander','{G}{U}'),qty:1},{card:c('green','{G}{G}'),qty:20},{card:c('blue','{U}'),qty:4}];const t=basicManaTargets(entries,['G','U'],36,entries[0].card);expect(t.G).toBe(28);expect(t.U).toBe(8);expect(t.U).toBeGreaterThan(0);expect(t.G+t.U).toBe(36);});
it('credits known existing nonbasic sources, including fractional flexible sources',()=>{const spells=[{card:c('green','{G}'),qty:30},{card:c('blue','{U}'),qty:10}];const withSources=basicManaTargets([...spells,{card:c('green source','','Land',{produced_mana:['G']}),qty:8}],['G','U'],28);expect(withSources).toEqual({G:19,U:9});expect(landManaSources(c('dual','','Land',{produced_mana:['G','U']}),['G','U'])).toEqual(['G','U']);expect(landManaSources(c('Forest of unknown','','Land'),['G'])).toEqual([]);});
it('preserves explicit C requirements and handles absent cost facts conservatively',()=>{expect(basicManaTargets([{card:c('colorless','{4}{C}{C}'),qty:1}],[],36)).toEqual({C:36});expect(basicManaTargets([{card:c('unknown',''),qty:1}],['W','U'],36)).toEqual({W:18,U:18});const t=basicManaTargets([{card:c('red','{R}'),qty:100},{card:c('commander','{U}'),qty:1}],['U','R'],36);expect(t.U).toBe(1);});

it('reduces commander source floors by known nonbasic coverage and never exceeds land slots',()=>{const commander=c('commander','{G}{U}');const entries=[{card:commander,qty:1},{card:c('green','{G}{G}'),qty:63}];const fixed={card:c('blue source','','Land',{produced_mana:['U']}),qty:4};const t=basicManaTargets([...entries,fixed],['G','U'],32,commander);expect(t.U).toBe(4);expect(t.G+t.U).toBe(32);const five=c('five','{W}{U}{B}{R}{G}');const scarce=basicManaTargets([{card:five,qty:1}],['W','U','B','R','G'],4,five);expect(Object.values(scarce).reduce((a,b)=>a+b,0)).toBe(4);});

it('separates front lands, playable modal backs and conditional transforming land backs',()=>{
 const faces=[{name:'Spell',type_line:'Enchantment',mana_cost:'{1}{R}{W}',oracle_text:'When this enters, it deals 1 damage to each creature.'},{name:'Back',type_line:'Legendary Land',oracle_text:'{T}: Add one mana of any color.'}];
 const transform=c('Path fixture','','Enchantment // Legendary Land',{layout:'transform',card_faces:faces,produced_mana:['W','U','R']});
 expect(landAllocation(transform)).toBe('conditional');expect(isLandSlot(transform)).toBe(false);expect(landManaSources(transform,['W','U','R'])).toEqual([]);expect(manaDemand([{card:{...transform,mana_cost:undefined},qty:1}])).toEqual({R:1,W:1});
 const modal={...transform,layout:'modal_dfc'};expect(landAllocation(modal)).toBe('modal');expect(isLandSlot(modal)).toBe(true);expect(landManaSources(modal,['W','U','R'])).toEqual(['W','U','R']);
 const front=c('Front land','','Land // Creature',{layout:'transform',card_faces:[{name:'Front',type_line:'Land',oracle_text:'{T}: Add {G}.'},{name:'Back',type_line:'Creature',oracle_text:'{T}: Add {R}.'}],produced_mana:['G','R']});expect(landAllocation(front)).toBe('front');expect(landManaSources(front,['G','R'])).toEqual(['G']);
});
