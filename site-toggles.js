// Applique les interrupteurs "Contrôle du site" (config table, gérés depuis
// assignments.html) aux éléments marqués avec les classes js-toggle-*.
// Tout reste caché par défaut (comportement actuel du site) si la requête
// échoue ou si les colonnes n'existent pas encore côté Supabase.
(async function () {
  try {
    const { data, error } = await sb
      .from('config')
      .select('show_extended_deadline_banner, show_conference_rooms, show_programme, show_register_button, show_copyright_form_link')
      .eq('id', 1)
      .single();
    if (error || !data) return;

    const reveal = (selector, on) => {
      if (!on) return;
      document.querySelectorAll(selector).forEach((el) => { el.style.display = ''; });
    };
    const hide = (selector, on) => {
      if (!on) return;
      document.querySelectorAll(selector).forEach((el) => { el.style.display = 'none'; });
    };

    reveal('.js-toggle-deadline-banner', data.show_extended_deadline_banner);
    // dates.html : bascule la carte "Paper Submission Deadline" entre la date
    // normale et la version barrée + nouvelle date, avec le même interrupteur.
    hide('.js-hide-when-deadline-extended', data.show_extended_deadline_banner);
    reveal('.js-toggle-rooms', data.show_conference_rooms);
    reveal('.js-toggle-programme', data.show_programme);
    reveal('.js-toggle-program-section', data.show_programme || data.show_conference_rooms);
    reveal('.js-toggle-register', data.show_register_button);
    reveal('.js-toggle-copyright', data.show_copyright_form_link);

    // Si un seul des deux (Programme / Rooms) est actif sur index.html, la grille
    // à 2 colonnes laisse un vide à la place de la colonne cachée — on repasse
    // en 1 colonne dans ce cas.
    const programGrid = document.getElementById('program-grid');
    if (programGrid && (data.show_programme !== data.show_conference_rooms)) {
      programGrid.style.gridTemplateColumns = '1fr';
    }

    // Les cartes Leaflet (map2 sur venue.html, mapIdx sur index.html) s'initialisent
    // pendant que leur conteneur est encore display:none (cette requête Supabase est
    // asynchrone) : Leaflet leur donne alors une taille de 0, qui ne se corrige pas
    // toute seule quand on révèle le conteneur ensuite — il faut invalidateSize().
    if (data.show_conference_rooms) {
      setTimeout(() => {
        if (typeof map2 !== 'undefined' && map2 && map2.invalidateSize) map2.invalidateSize();
        if (typeof mapIdx !== 'undefined' && mapIdx && mapIdx.invalidateSize) mapIdx.invalidateSize();
      }, 150);
    }
  } catch (e) {
    console.error('site-toggles.js:', e);
  }
})();
