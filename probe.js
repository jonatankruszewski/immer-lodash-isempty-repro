// Probes the blast radius of the 11.1.9 constructor/__proto__ hardening.
const {produce, setAutoFreeze} = require('immer');
setAutoFreeze(false);
console.log('immer', require('immer/package.json').version, '\n');

const t = (name, fn) => {
  try {
    console.log(`${name}: ${fn()}`);
  } catch (e) {
    console.log(`${name}: THREW ${e.constructor.name}: ${String(e.message).slice(0, 90)}`);
  }
};

// --- Ecosystem compatibility ---
t('lodash.isEmpty(draft)      ', () => require('lodash').isEmpty(produce({}, d => { require('lodash').isEmpty(d); }) ?? 'n/a'));
t('draft.constructor === Object', () => produce({}, d => d.constructor === Object));
t("'constructor' in draft     ", () => produce({}, d => 'constructor' in d));
t('draft.constructor.prototype ', () => produce({}, d => { d.constructor.prototype; return 'ok'; }));
t('draft.hasOwnProperty("a")  ', () => produce({a: 1}, d => d.hasOwnProperty('a')));

// --- Data loss: legit data keys named "prototype"/"constructor" ---
t('set draft.prototype = 42   ', () => JSON.stringify(produce({}, d => { d.prototype = 42; })));
t('set draft.constructor = 42 ', () => JSON.stringify(produce({}, d => { d.constructor = 42; })));
t('read own data key ctor     ', () => produce({constructor: 'hello'}, d => typeof d.constructor));

// --- Does the claimed CVE attack actually work (test on 11.1.8 too)? ---
t('Object.assign payload      ', () => {
  produce({}, d => Object.assign(d, JSON.parse('{"constructor":{"prototype":{"pwned":1}}}')));
  return 'Object.prototype.pwned = ' + ({}).pwned;
});
t('plain JS (no immer at all) ', () => {
  const o = {}; o.constructor.prototype.pwnedPlain = 1;
  const r = 'Object.prototype.pwnedPlain = ' + ({}).pwnedPlain;
  delete Object.prototype.pwnedPlain; return r;
});
