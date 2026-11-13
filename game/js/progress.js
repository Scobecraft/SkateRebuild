/* Concrete Flow – Fortschritt: XP, Level, Ränge, Streaks, Freischaltungen */
window.CF = window.CF || {};
CF.Progress = (() => {
  const store = {
    get(k, d) { try { const v = localStorage.getItem('cf_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('cf_' + k, JSON.stringify(v)); } catch (e) { /* ignorieren */ } },
  };
  const MAX_LEVEL = 50;
  const RANKS = [[1, 'Rookie'], [5, 'Local'], [10, 'Park Rat'], [16, 'Amateur'], [24, 'Gesponsert'], [32, 'Pro'], [42, 'Legende']];
  // Outfit-Freischaltungen (Index in CF.OUTFITS → benötigtes Level)
  const OUTFIT_LEVEL = [1, 1, 3, 5, 8, 12, 16, 20];
  const st = Object.assign({ xp: 0, streak: 0, bestStreak: 0, unlockAll: false }, store.get('progress', {}));

  // Benötigte Gesamt-XP für Level n (Level 1 = 0 XP)
  const xpFor = n => Math.round(400 * (n - 1) * (n - 1) + 600 * (n - 1));
  function levelOf(xp) { let n = 1; while (n < MAX_LEVEL && xp >= xpFor(n + 1)) n++; return n; }
  function save() { store.set('progress', st); }

  return {
    get level() { return levelOf(st.xp); },
    get xp() { return st.xp; },
    get streak() { return st.streak; },
    get bestStreak() { return st.bestStreak; },
    get rank() { const l = levelOf(st.xp); let r = RANKS[0][1]; for (const [n, name] of RANKS) if (l >= n) r = name; return r; },
    get levelProgress() { const l = levelOf(st.xp); if (l >= MAX_LEVEL) return 1; return (st.xp - xpFor(l)) / (xpFor(l + 1) - xpFor(l)); },
    get nextLevelXp() { const l = levelOf(st.xp); return l >= MAX_LEVEL ? 0 : xpFor(l + 1) - st.xp; },
    // Streak-Bonus: +10 % pro Streak-Stufe, max. +100 %
    get streakBonus() { return 1 + Math.min(st.streak, 10) * 0.1; },
    outfitUnlocked(i) { return st.unlockAll || this.level >= (OUTFIT_LEVEL[i] || 99); },
    outfitLevel(i) { return OUTFIT_LEVEL[i] || 99; },

    /* Combo gutgeschrieben → XP + Streak */
    addXP(amount) {
      const before = levelOf(st.xp);
      st.xp += Math.round(amount);
      const after = levelOf(st.xp);
      save();
      if (after > before) {
        const unlocked = OUTFIT_LEVEL.map((l, i) => l > before && l <= after ? CF.OUTFITS[i].name : null).filter(Boolean);
        CF.onLevelUp && CF.onLevelUp(after, this.rank, unlocked);
      }
    },
    comboLanded(points) {
      if (points < 400) return 0;   // kleine Combos zählen nicht für den Streak
      st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); save();
      return st.streak;
    },
    breakStreak() { const s = st.streak; st.streak = 0; save(); return s; },
    reset() { st.xp = 0; st.streak = 0; st.bestStreak = 0; st.unlockAll = false; save(); },
    unlockAll() { st.unlockAll = true; save(); },
    setLevel(n) { st.xp = xpFor(Math.max(1, Math.min(MAX_LEVEL, n))); save(); },
  };
})();
