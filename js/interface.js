(function(){
  "use strict";

  /* Адрес воркера. Свой, не хорековский. */
  var API = "https://offerhut-varaus.offerhut-fi.workers.dev";

  /* ЗАГЛУШКА: поиск по базе сайта. Сейчас у offerhut.fi эндпоинта нет —
     фильтр /offers/ отдаёт целую страницу HTML, не JSON. Когда появится,
     сюда встанет его адрес, и etsi() пойдёт за данными туда. */
  var HAE_URL = "";

  /* Простыня уточнений заказчика ложится сюда. Добавить уточнение = одна
     строка здесь и такая же в списке в промпте воркера. Больше нигде.
       kysy:true — без этого не ищем */
  /* Снято со страницы объекта offerhut.fi: словарь BX.message, 98 ключей.
     Это и есть та простыня уточнений. Агент спрашивает только kysy:true,
     остальное берёт, если гость сказал сам. */
  var KRITEERIT = [
    // без этого не ищем
    { id:"saapuminen",  nayta:"Saapuu",    kysy:true  },
    { id:"lahto",       nayta:"Lähtee",    kysy:true  },
    { id:"aikuiset",    nayta:"Aikuiset",  kysy:true  },
    { id:"budjetti",    nayta:"Budjetti",  kysy:true  },
    // состав группы: цена считается по нему, лишний человек платный
    { id:"lapset",      nayta:"Lapset",    kysy:false },   // alle 12v
    { id:"pikkulapset", nayta:"Alle 2v",   kysy:false },
    { id:"henkiloa",    nayta:"",          kysy:false },   // сумма, считается сама
    // питомцы: на сайте разбиты по размеру, цена у каждого своя
    { id:"koira_s",     nayta:"Koira <25", kysy:false },
    { id:"koira_m",     nayta:"Koira <40", kysy:false },
    { id:"koira_l",     nayta:"Koira >40", kysy:false },
    { id:"kissa",       nayta:"Kissa",     kysy:false },
    { id:"muu_lemmikki",nayta:"Lemmikki",  kysy:false },
    // где и что
    { id:"alue",        nayta:"Alue",      kysy:false },
    { id:"savusauna",   nayta:"Savusauna", kysy:false },
    { id:"palju",       nayta:"Palju",     kysy:false },
    { id:"poreallas",   nayta:"Poreallas", kysy:false },
    { id:"vene",        nayta:"Vene",      kysy:false },
    { id:"kalastus",    nayta:"Kalastus",  kysy:false },
    // время приезда и отъезда: на сайте платные опции
    { id:"aikainen_tulo",   nayta:"Aikainen tulo",  kysy:false },
    { id:"myohainen_tulo",  nayta:"Myöhäinen tulo", kysy:false },
    { id:"myohainen_lahto", nayta:"Myöhäinen lähtö",kysy:false },
    { id:"muuta",       nayta:"",          kysy:false }
  ];

  /* ЗАГЛУШКА: объекты. Заказчик пришлёт 3-4 с параметрами. Поля названы так,
     как их должен отдавать будущий эндпоинт поиска. */
  var OBJEKTIT = [
    { id:"o1", nimi:"0131 Välisesonki alk 7 vrk", alue:"Pohjois-Karjala",
      makuuhuoneet:3, vuodepaikat:8, wc:2, hinta_vrk:100, hinta_vko:630,
      ale:0, varustus:["sauna"], kuva:"img/g1.jpg", url:"" },
    { id:"o2", nimi:"0043 Pääsiäinen alk 2 vrk", alue:"Pohjois-Karjala",
      makuuhuoneet:3, vuodepaikat:8, wc:2, hinta_vrk:108, hinta_vko:680,
      ale:18, varustus:["sauna","vene"], kuva:"img/g2.jpg", url:"" },
    { id:"o3", nimi:"0088 Kesäviikko alk 7 vrk", alue:"Etelä-Savo",
      makuuhuoneet:4, vuodepaikat:10, wc:2, hinta_vrk:160, hinta_vko:980,
      ale:0, varustus:["sauna","vene","palju"], kuva:"img/g3.jpg", url:"" },
    { id:"o4", nimi:"0205 Talviloma alk 3 vrk", alue:"Lappi",
      makuuhuoneet:2, vuodepaikat:6, wc:1, hinta_vrk:135, hinta_vko:820,
      ale:12, varustus:["sauna","palju"], kuva:"img/g4.jpg", url:"" }
  ];

  /* Доп. услуги — полный список со страницы объекта offerhut.fi.
     ЦЕНЫ ЗАГЛУШЕЧНЫЕ: на сайте они свои у каждого объекта и приходят
     вместе с ним. Когда появится эндпоинт, этот список заменится тем,
     что отдаст поле lisapalvelut.
       per: "varaus" за бронь, "hlo" за человека, "vrk" за сутки,
            "paikalla" — платится владельцу на месте, сумму мы не берём */
  var LISAT = [
    // проживание
    { r:"r_majoitus",  id:"liinavaatteet", nimi:"Liinavaatteet", alt:"Setti yhdelle: tyynyliina, pussilakana, lakana, pyyhkeet", hinta:18, per:"hlo" },
    { r:"r_majoitus",  id:"loppusiivous",  nimi:"Loppusiivous",  alt:"Lähtösiivous tehtynä",      hinta:95,  per:"varaus" },
    { r:"r_majoitus",  id:"polttopuut",    nimi:"Polttopuut",    alt:"Säkki",                     hinta:25,  per:"varaus" },
    { r:"r_majoitus",  id:"internet",      nimi:"Internetyhteys",alt:"",                          hinta:0,   per:"varaus" },
    { r:"r_majoitus",  id:"aikainen_tulo", nimi:"Aikainen tulo", alt:"Sallittu alk. klo",         hinta:40,  per:"varaus" },
    { r:"r_majoitus",  id:"myohainen_tulo",nimi:"Myöhäinen tulo",alt:"Sallittu viimeisin klo",    hinta:40,  per:"varaus" },
    { r:"r_majoitus",  id:"myohainen_lahto",nimi:"Myöhäinen lähtö",alt:"",                        hinta:40,  per:"varaus" },
    // баня и отдых
    { r:"r_sauna", id:"palju",     nimi:"Palju",        alt:"Lämmitettynä tuloon",       hinta:120, per:"varaus" },
    { r:"r_sauna", id:"poreallas", nimi:"Poreallas",    alt:"",                          hinta:90,  per:"varaus" },
    { r:"r_sauna", id:"savusauna", nimi:"Savusauna",    alt:"Lämmitys",                  hinta:150, per:"varaus" },
    { r:"r_sauna", id:"grilli",    nimi:"Grillivälineet",alt:"",                         hinta:20,  per:"varaus" },
    // на воде
    { r:"r_vesi",   id:"soutuvene",     nimi:"Soutuvene",     alt:"Airot mukana",              hinta:45,  per:"varaus" },
    { r:"r_vesi",   id:"lisavene",      nimi:"Lisä-soutuvene",alt:"",                          hinta:45,  per:"varaus" },
    { r:"r_vesi",   id:"peramoottori",  nimi:"Perämoottori",  alt:"Benssa lisämaksulla",       hinta:120, per:"varaus" },
    { r:"r_vesi",   id:"kanootti",      nimi:"Kanootti",      alt:"",                          hinta:60,  per:"varaus" },
    { r:"r_vesi",   id:"kajakki",       nimi:"Kajakki",       alt:"",                          hinta:60,  per:"varaus" },
    { r:"r_vesi",   id:"sup",           nimi:"SUP lauta",     alt:"",                          hinta:50,  per:"varaus" },
    { r:"r_vesi",   id:"pelastusliivit",nimi:"Pelastusliivit",alt:"",                          hinta:10,  per:"hlo" },
    // рыбалка
    { r:"r_kala",  id:"kalastusvalineet",nimi:"Kalastusvälineet ja -luvat", alt:"",            hinta:55,  per:"varaus" },
    { r:"r_kala",  id:"onki",          nimi:"Onki",          alt:"",                          hinta:12,  per:"varaus" },
    { r:"r_kala",  id:"virveli",       nimi:"Virveli",       alt:"",                          hinta:20,  per:"varaus" },
    { r:"r_kala",  id:"verkko",        nimi:"Kalastusverkko",alt:"1 verkko + 1 lupa",         hinta:35,  per:"varaus" },
    { r:"r_kala",  id:"katiska",       nimi:"Katiska",       alt:"",                          hinta:25,  per:"varaus" },
    { r:"r_kala",  id:"ravustus",      nimi:"Ravustus",      alt:"1 rapuverkko + 1 lupa",     hinta:35,  per:"varaus" },
    { r:"r_kala",  id:"madot",         nimi:"Madot",         alt:"",                          hinta:8,   per:"varaus" },
    { r:"r_kala",  id:"kalahaavi",     nimi:"Kalahaavi",     alt:"",                          hinta:10,  per:"varaus" },
    { r:"r_kala",  id:"savustin",      nimi:"Savustin",      alt:"",                          hinta:25,  per:"varaus" },
    { r:"r_kala",  id:"kaira",         nimi:"Kaira",         alt:"Jääkaira",                  hinta:25,  per:"varaus" },
    // с детьми
    { r:"r_lapset",  id:"pinnasanky",    nimi:"Pinnasänky",    alt:"",                          hinta:20,  per:"varaus" },
    { r:"r_lapset",  id:"syottotuoli",   nimi:"Syöttötuoli",   alt:"",                          hinta:15,  per:"varaus" },
    { r:"r_lapset",  id:"trampoliini",   nimi:"Trampoliini",   alt:"",                          hinta:45,  per:"varaus" },
    // прочее
    { r:"r_muut",      id:"joulukuusi",    nimi:"Aito joulukuusi",alt:"",                         hinta:45,  per:"varaus" },
    { r:"r_muut",      id:"kuljetus",      nimi:"Kuljetus",      alt:"Meno-paluu",                hinta:0,   per:"paikalla" }
  ];

  /* Правила цены, снятые со страницы объекта. Пока только показываем
     предупреждение — расчёт придёт с эндпоинта вместе с объектом. */
  var SAANNOT = {
    yliryhma:  "Ryhmän koko ylittää tarjoukseen sisältyvän henkilömäärän. Hintaan lisätään maksu lisähenkilöstä.",
    epasaann:  "Epäsäännöllinen tulo- tai lähtöpäivä. Vuokrahinta lasketaan lähimmän säännöllisen päivän mukaan.",
    lyhyt:     "Valittu ajanjakso on tarjousta lyhyempi. Hinta lasketaan säännölliselle ajanjaksolle.",
    paikalla:  "Hinta ja ehdot neuvotellaan vuokranantajan kanssa. OfferHut ei vastaa tästä palvelusta."
  };

  /* Четыре параметра, с которых начинается поиск — те же, что в форме
     на offerhut.fi: период, регион, цена от и до, число гостей.
     Пока на параметр не ответили, он подсвечен. */
  var EHDOT = [
    { id:"aika",    nimi:"e_aika",  tyhja:"t_aika",
      arvo:function(){
        var a = tila.kriteerit.saapuminen, b = tila.kriteerit.lahto;
        if (!a) return "";
        return suomiPvm(a) + (b ? " – " + suomiPvm(b) : " – ?");
      },
      valmis:function(){ return !!(tila.kriteerit.saapuminen && tila.kriteerit.lahto); } },
    { id:"alue",    nimi:"e_alue",  tyhja:"t_alue",
      arvo:function(){ return tila.kriteerit.alue || ""; },
      valmis:function(){ return !!tila.kriteerit.alue; } },
    { id:"hinta",   nimi:"e_hinta", tyhja:"t_hinta",
      arvo:function(){
        var a = tila.kriteerit.hinta_min, b = tila.kriteerit.hinta_max;
        if (!a && !b) return "";
        return (a || "0") + " – " + (b || "?") + " €";
      },
      valmis:function(){ return !!(tila.kriteerit.hinta_min || tila.kriteerit.hinta_max); } },
    { id:"vieraat", nimi:"e_vieraat", tyhja:"t_vieraat",
      arvo:function(){
        var a = parseInt(tila.kriteerit.aikuiset, 10) || 0;
        var l = parseInt(tila.kriteerit.lapset, 10) || 0;
        if (!a && !l) return "";
        return a + " aik" + (l ? " + " + l + " lasta" : "");
      },
      valmis:function(){ return !!henkilomaara(); } }
  ];


  /* ПЕРЕВОД ИНТЕРФЕЙСА. Язык выбирается в шапке и меняет всё меню.
     Названия доп. услуг сюда не входят: они приходят с объектом
     с сайта и переводятся на его стороне. */
  var TEKSTIT = {
    fi: {
      ph:"Paina nappia ja puhu — tai kirjoita",
      hakutulos:"Hakutulos", kysymys:"Kysymys",
      e_aika:"Ajankohta", e_alue:"Alue", e_hinta:"Hinta /vrk", e_vieraat:"Vieraat",
      t_aika:"pp.kk. – pp.kk.", t_alue:"koko Suomi", t_hinta:"mistä – mihin", t_vieraat:"kuinka monta",
      o_mokit:"Sopivat mökit", o_lisat:"Lisää varaukseen", o_tiedot:"Varaajan tiedot",
      vihje:"Sano “ensimmäinen” tai “halvempi” — tai valitse napilla.",
      b_valitse:"Valitse", b_jatka:"Jatka varaukseen", b_maksuun:"Maksuun", b_uusi:"Uusi haku",
      l_nimi:"Nimi", l_posti:"Sähköposti", l_puhelin:"Puhelin",
      vahvistettu:"Varaus vahvistettu", yhteensa:"Yhteensä", sisaltyy:"sisältyy",
      paikalla:"paikan päällä", veloituksetta:"veloituksetta",
      s_yhdistaa:"Yhdistetään…", s_kuuntelen:"Kuuntelen", s_valmis:"paina uudestaan kun lopetat", s_kasittelen:"Käsittelen…",
      s_lyhyt:"Liian lyhyt. Paina nappia ja puhu.",
      s_ei_tue:"Selaimesi ei tue äänitallennusta. Kirjoita tähän.",
      s_salli:"Salli mikrofoni selaimen asetuksista.",
      s_virhe:"Äänen käsittely ei onnistunut. Kirjoita tähän.",
      yhteys:"Yhteys katkesi. Kokeile uudelleen.",
      ei_osumia:"Ei sopivia kohteita. Kerro toiset päivät tai budjetti.",
      yota:"yötä", hlo:"hlö", kohdetta:"kohdetta",
      r_majoitus:"Majoitus", r_sauna:"Sauna ja palju", r_vesi:"Vesillä",
      r_kala:"Kalastus", r_lapset:"Lapsille", r_muut:"Muut",
      b_takaisin:"‹ Takaisin hakutuloksiin", b_varaa:"Varaa",
      k_mh:"makuuhuonetta", k_vuodepaikkaa:"vuodepaikkaa", k_wc:"wc",
      p_vrk:"/vrk", p_vko:"/vko", sisaltyy_hintaan:"Hintaan sisältyy",
      v_sauna:"Sauna", v_vene:"Vene", v_palju:"Palju",
      vihje_muuta:"Voit muuttaa hakuehtoja puhumalla — sano vain."
    },
    sv: {
      ph:"Tryck på knappen och tala — eller skriv",
      hakutulos:"Sökresultat", kysymys:"Fråga",
      e_aika:"Tidpunkt", e_alue:"Område", e_hinta:"Pris /dygn", e_vieraat:"Gäster",
      t_aika:"dd.mm. – dd.mm.", t_alue:"hela Finland", t_hinta:"från – till", t_vieraat:"hur många",
      o_mokit:"Lämpliga stugor", o_lisat:"Lägg till bokningen", o_tiedot:"Bokarens uppgifter",
      vihje:"Säg ”den första” eller ”billigare” — eller välj med knappen.",
      b_valitse:"Välj", b_jatka:"Fortsätt till bokning", b_maksuun:"Till betalning", b_uusi:"Ny sökning",
      l_nimi:"Namn", l_posti:"E-post", l_puhelin:"Telefon",
      vahvistettu:"Bokningen bekräftad", yhteensa:"Totalt", sisaltyy:"ingår",
      paikalla:"på plats", veloituksetta:"utan avgift",
      s_yhdistaa:"Ansluter…", s_kuuntelen:"Lyssnar", s_valmis:"tryck igen när du slutar", s_kasittelen:"Bearbetar…",
      s_lyhyt:"För kort. Tryck på knappen och tala.",
      s_ei_tue:"Din webbläsare stöder inte ljudinspelning. Skriv här.",
      s_salli:"Tillåt mikrofonen i webbläsarens inställningar.",
      s_virhe:"Ljudet kunde inte behandlas. Skriv här.",
      yhteys:"Anslutningen bröts. Försök igen.",
      ei_osumia:"Inga lämpliga objekt. Ange andra datum eller budget.",
      yota:"nätter", hlo:"pers", kohdetta:"objekt",
      r_majoitus:"Boende", r_sauna:"Bastu och badtunna", r_vesi:"På vattnet",
      r_kala:"Fiske", r_lapset:"För barn", r_muut:"Övrigt",
      b_takaisin:"‹ Tillbaka till sökresultatet", b_varaa:"Boka",
      k_mh:"sovrum", k_vuodepaikkaa:"bäddar", k_wc:"wc",
      p_vrk:"/dygn", p_vko:"/vecka", sisaltyy_hintaan:"Ingår i priset",
      v_sauna:"Bastu", v_vene:"Båt", v_palju:"Badtunna",
      vihje_muuta:"Du kan ändra sökvillkoren genom att tala — säg bara till."
    },
    en: {
      ph:"Tap the button and speak — or type",
      hakutulos:"Search result", kysymys:"Question",
      e_aika:"Dates", e_alue:"Area", e_hinta:"Price /night", e_vieraat:"Guests",
      t_aika:"dd.mm. – dd.mm.", t_alue:"all Finland", t_hinta:"from – to", t_vieraat:"how many",
      o_mokit:"Matching cottages", o_lisat:"Add to booking", o_tiedot:"Your details",
      vihje:"Say “the first” or “cheaper” — or pick with the button.",
      b_valitse:"Choose", b_jatka:"Continue to booking", b_maksuun:"To payment", b_uusi:"New search",
      l_nimi:"Name", l_posti:"Email", l_puhelin:"Phone",
      vahvistettu:"Booking confirmed", yhteensa:"Total", sisaltyy:"included",
      paikalla:"paid on site", veloituksetta:"free of charge",
      s_yhdistaa:"Connecting…", s_kuuntelen:"Listening", s_valmis:"tap again to end", s_kasittelen:"Processing…",
      s_lyhyt:"Too short. Tap the button and speak.",
      s_ei_tue:"Your browser does not support recording. Type here.",
      s_salli:"Allow the microphone in your browser settings.",
      s_virhe:"Could not process the audio. Type here.",
      yhteys:"Connection lost. Try again.",
      ei_osumia:"No matching cottages. Try other dates or budget.",
      yota:"nights", hlo:"guests", kohdetta:"cottages",
      r_majoitus:"Accommodation", r_sauna:"Sauna and hot tub", r_vesi:"On the water",
      r_kala:"Fishing", r_lapset:"For children", r_muut:"Other",
      b_takaisin:"‹ Back to results", b_varaa:"Book",
      k_mh:"bedrooms", k_vuodepaikkaa:"beds", k_wc:"wc",
      p_vrk:"/night", p_vko:"/week", sisaltyy_hintaan:"Included in the price",
      v_sauna:"Sauna", v_vene:"Boat", v_palju:"Hot tub",
      vihje_muuta:"You can change the search by speaking — just say it."
    },
    de: {
      ph:"Einmal tippen und sprechen — oder tippen",
      hakutulos:"Suchergebnis", kysymys:"Frage",
      e_aika:"Zeitraum", e_alue:"Gebiet", e_hinta:"Preis /Nacht", e_vieraat:"Gäste",
      t_aika:"TT.MM. – TT.MM.", t_alue:"ganz Finnland", t_hinta:"von – bis", t_vieraat:"wie viele",
      o_mokit:"Passende Hütten", o_lisat:"Zur Buchung hinzufügen", o_tiedot:"Ihre Angaben",
      vihje:"Sagen Sie „die erste“ oder „günstiger“ — oder wählen Sie per Taste.",
      b_valitse:"Wählen", b_jatka:"Weiter zur Buchung", b_maksuun:"Zur Zahlung", b_uusi:"Neue Suche",
      l_nimi:"Name", l_posti:"E-Mail", l_puhelin:"Telefon",
      vahvistettu:"Buchung bestätigt", yhteensa:"Gesamt", sisaltyy:"inbegriffen",
      paikalla:"vor Ort zu zahlen", veloituksetta:"kostenlos",
      s_yhdistaa:"Verbinde…", s_kuuntelen:"Ich höre zu", s_valmis:"erneut tippen zum Beenden", s_kasittelen:"Verarbeite…",
      s_lyhyt:"Zu kurz. Taste halten und sprechen.",
      s_ei_tue:"Ihr Browser unterstützt keine Aufnahme. Bitte tippen.",
      s_salli:"Mikrofon in den Browsereinstellungen erlauben.",
      s_virhe:"Audio konnte nicht verarbeitet werden. Bitte tippen.",
      yhteys:"Verbindung unterbrochen. Erneut versuchen.",
      ei_osumia:"Keine passenden Hütten. Andere Daten oder Budget nennen.",
      yota:"Nächte", hlo:"Pers.", kohdetta:"Hütten",
      r_majoitus:"Unterkunft", r_sauna:"Sauna und Hot Tub", r_vesi:"Auf dem Wasser",
      r_kala:"Angeln", r_lapset:"Für Kinder", r_muut:"Sonstiges",
      b_takaisin:"‹ Zurück zum Suchergebnis", b_varaa:"Buchen",
      k_mh:"Schlafzimmer", k_vuodepaikkaa:"Betten", k_wc:"WC",
      p_vrk:"/Nacht", p_vko:"/Woche", sisaltyy_hintaan:"Im Preis enthalten",
      v_sauna:"Sauna", v_vene:"Boot", v_palju:"Hot Tub",
      vihje_muuta:"Sie können die Suche per Sprache ändern — sagen Sie es einfach."
    },
    fr: {
      ph:"Appuyez sur le bouton et parlez — ou écrivez",
      hakutulos:"Résultat", kysymys:"Question",
      e_aika:"Dates", e_alue:"Région", e_hinta:"Prix /nuit", e_vieraat:"Voyageurs",
      t_aika:"jj.mm. – jj.mm.", t_alue:"toute la Finlande", t_hinta:"de – à", t_vieraat:"combien",
      o_mokit:"Chalets correspondants", o_lisat:"Ajouter à la réservation", o_tiedot:"Vos coordonnées",
      vihje:"Dites « le premier » ou « moins cher » — ou choisissez au bouton.",
      b_valitse:"Choisir", b_jatka:"Continuer la réservation", b_maksuun:"Vers le paiement", b_uusi:"Nouvelle recherche",
      l_nimi:"Nom", l_posti:"E-mail", l_puhelin:"Téléphone",
      vahvistettu:"Réservation confirmée", yhteensa:"Total", sisaltyy:"inclus",
      paikalla:"à régler sur place", veloituksetta:"sans frais",
      s_yhdistaa:"Connexion…", s_kuuntelen:"J’écoute", s_valmis:"appuyez à nouveau pour finir", s_kasittelen:"Traitement…",
      s_lyhyt:"Trop court. Appuyez sur le bouton et parlez.",
      s_ei_tue:"Votre navigateur ne gère pas l’enregistrement. Écrivez ici.",
      s_salli:"Autorisez le micro dans les réglages du navigateur.",
      s_virhe:"Impossible de traiter l’audio. Écrivez ici.",
      yhteys:"Connexion perdue. Réessayez.",
      ei_osumia:"Aucun chalet correspondant. Donnez d’autres dates ou budget.",
      yota:"nuits", hlo:"pers", kohdetta:"chalets",
      r_majoitus:"Hébergement", r_sauna:"Sauna et bain nordique", r_vesi:"Sur l’eau",
      r_kala:"Pêche", r_lapset:"Pour les enfants", r_muut:"Autres",
      b_takaisin:"‹ Retour aux résultats", b_varaa:"Réserver",
      k_mh:"chambres", k_vuodepaikkaa:"couchages", k_wc:"wc",
      p_vrk:"/nuit", p_vko:"/semaine", sisaltyy_hintaan:"Inclus dans le prix",
      v_sauna:"Sauna", v_vene:"Bateau", v_palju:"Bain nordique",
      vihje_muuta:"Vous pouvez modifier la recherche en parlant — dites-le simplement."
    }
  };

  var kieli = "fi";
  function T(avain){
    var s = TEKSTIT[kieli] && TEKSTIT[kieli][avain];
    return s || TEKSTIT.fi[avain] || "";
  }

  /* Перерисовывает весь интерфейс на выбранном языке. */
  /* «Держите кнопку и говорите» — подсказка на один раз: объяснить, как
     этим пользуются. Человек ответил — он уже знает, и надпись уходит
     насовсем, в том числе при смене языка. */
  var opastettu = false;
  function opastusPois(){
    opastettu = true;
    var say = el("say");
    if (say) say.setAttribute("placeholder", "");
  }

  function kaanna(){
    var say = el("say");
    if (say) say.setAttribute("placeholder", opastettu ? "" : T("ph"));
    var parit = [
      ["o_lisat","#vaihe3 h2"], ["o_tiedot","#vaihe4 h2"],
      ["b_takaisin","#takaisin"], ["b_varaa","#toLisat"],
      ["b_jatka","#toForm"], ["b_maksuun","#pay"],
      ["b_uusi","#restart"], ["b_uusi","#uusiHaku"], ["vahvistettu","#vaihe5 h3"]
    ];
    parit.forEach(function(p){
      var n = document.querySelector(p[1]);
      if (n) n.textContent = T(p[0]);
    });
    var lbl = document.querySelectorAll("#vaihe4 .lbl");
    var avaimet = ["l_nimi","l_posti","l_puhelin"];
    for (var i = 0; i < lbl.length && i < 3; i++) lbl[i].textContent = T(avaimet[i]);
    // Подпись у текущего вопроса тоже на новом языке: номер внутри
    // сохраняем, меняем только слово.
    var merkit = document.querySelectorAll("#kysymys .merkki");
    for (var m = 0; m < merkit.length; m++) {
      var nro = merkit[m].querySelector("b");
      merkit[m].innerHTML = T("kysymys") + "<b>" + (nro ? nro.textContent : "") + "</b>";
    }
    if (typeof paivitaRail === "function") paivitaRail();
    piirraEhdot();
    if (tila.valittu) { piirraKortti(); piirraLisat(); }
    if (tila.ehdokkaat.length) piirraKortit();
  }

  var tila = { kriteerit:{}, historia:[], ehdokkaat:[], valittu:null, lisat:{}, asiakas:{}, vaihe:1 };
  var el = function(id){ return document.getElementById(id); };
  function eur(x){ return (Math.round(x*100)/100).toFixed(2).replace(".",",")+" €"; }
  function eurLyhyt(x){ return Math.round(x) + " €"; }

  /* ---------- экраны ---------- */
  function vaihe(n){
    tila.vaihe = n;
    [1,2,3,4,5].forEach(function(i){
      var s = el("vaihe"+i); if (s) s.classList.toggle("hide", i !== n);
    });
    // Фото держим только на первом экране: дальше идут цифры и поля,
    // их читают на белом.
    document.body.classList.toggle("foto", n === 1);
    el("shot").style.display = (n === 1) ? "" : "none";
    el("dock").classList.toggle("hide", n === 5);
    window.scrollTo(0,0);
  }

  /* Вопрос агента попадает в два места сразу: над панелью — ТЕКУЩИЙ, он
     там сменяется; и строкой в ленту внутри рамки ввода, где разговор
     копится и прокручивается. Ответ гостя идёт только в ленту. */
  function puhu(kuka, teksti, odota){
    var lista = el("puhelu"), ylin = el("kysymys");

    function lisaa(luokka){
      if (!lista) return;
      var d = document.createElement("div");
      d.className = luokka;
      d.textContent = teksti;
      lista.appendChild(d);
      lista.scrollTop = lista.scrollHeight;
    }

    if (kuka === "me") { lisaa("a"); return { remove:function(){} }; }

    if (odota) {
      // Ожидание висит только наверху: в ленте от него остался бы мусор.
      var vanha = ylin ? { html: ylin.innerHTML, cls: ylin.className } : null;
      if (ylin) { ylin.className = "kysymys wait"; ylin.textContent = teksti; }
      return { remove:function(){
        // Если ответ не пришёл и вопрос никто не сменил — возвращаем прежний.
        if (ylin && vanha && ylin.classList.contains("wait")) {
          ylin.className = vanha.cls;
          ylin.innerHTML = vanha.html;
        }
      } };
    }

    if (ylin) {
      ylin.className = "kysymys";
      ylin.innerHTML = '<span class="merkki">' + T("kysymys") + "<b>" + numero() + "</b></span><span></span>";
      ylin.lastChild.textContent = teksti;
    }
    lisaa("q");
    return { remove:function(){} };
  }

  /* Номер вопроса считается по тем же четырём параметрам поиска. */
  function numero(){
    var tehty = EHDOT.filter(function(x){ return x.valmis(); }).length;
    return Math.min(tehty + 1, EHDOT.length) + "/" + EHDOT.length;
  }

  /* Подсвечен тот параметр, который спрашивают сейчас — первый незакрытый. */
  function kysyttava(){return SearchController.missing(tila.kriteerit);}

/* Карта уходит на время разговора и возвращается с результатом. */
function tyopoyta(puhutaan){document.body.classList.toggle('puhutaan',!!puhutaan);if(!puhutaan)requestAnimationFrame(asetaKartta);}

  function piirraEhdot(){
    var e = el("ehdot");
    if (!e) return;
    var nyt = kysyttava();
    e.innerHTML = EHDOT.map(function(x){
      var v = x.arvo();
      var luokka = "ehto" + (v ? "" : " auki") + (x.id === nyt ? " kysytaan" : "");
      return '<div class="' + luokka + '">' +
               '<span class="nimi">' + T(x.nimi) + '</span>' +
               '<span class="arvo">' + (v || T(x.tyhja)) + '</span>' +
             '</div>';
    }).join("");
  }

  function piirraChips(){
    // Чипов больше нет: собранное показывают четыре параметра под панелью.
    piirraEhdot();
  }

  /* ---------- поиск ----------
     Пока по массиву в этом файле. Когда у сайта появится эндпоинт, тело
     заменится на запрос к HAE_URL — наружу функция не меняется. */
  function etsi(){
    var k = tila.kriteerit;
    var hlo = henkilomaara();
    var budj = Number(k.hinta_max || 0);
    var minBudj = Number(k.hinta_min || 0);
    var yot = oita(k.saapuminen, k.lahto);

    var lista = OBJEKTIT.filter(function(o){
      if (hlo && o.vuodepaikat < hlo) return false;
      // Бюджет гость называет как придётся — за поездку или за сутки.
      // Считаем за поездку, если знаем число ночей, и даём 15 % запаса:
      // отсечь по копейкам хуже, чем показать на один вариант больше.
      if (budj && o.hinta_vrk > budj) return false;
      if (minBudj && o.hinta_vrk < minBudj) return false;
      return true;
    });

    // Объект без запрошенного допа не выбрасываем — допы часто докупаются.
    // Но тот, где всё уже есть, идёт выше.
    lista.sort(function(a,b){ return paino(b) - paino(a) || a.hinta_vrk - b.hinta_vrk; });
    function paino(o){
      var p = 0;
      ["sauna","vene","palju"].forEach(function(f){
        if (k[f] && o.varustus.indexOf(f) >= 0) p++;
      });
      return p;
    }
    tila.ehdokkaat = lista.slice(0, 5);
    return tila.ehdokkaat;
  }

  function oita(a, b){
    var d1 = pvm(a), d2 = pvm(b);
    if (!d1 || !d2) return 0;
    var n = Math.round((d2 - d1) / 86400000);
    return n > 0 ? n : 0;
  }
  // Дата приходит от модели как YYYY-MM-DD. Прочее не разбираем: пусть
  // лучше число ночей будет неизвестно, чем угадано неверно.
  function pvm(s){
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||"").trim());
    return m ? new Date(+m[1], +m[2]-1, +m[3]) : null;
  }

  function summa(){
    if (!tila.valittu) return 0;
    var yot = oita(tila.kriteerit.saapuminen, tila.kriteerit.lahto) || 1;
    var hlo = henkilomaara() || 1;
    var s = tila.valittu.hinta_vrk * yot;
    LISAT.forEach(function(l){
      if (!tila.lisat[l.id]) return;
      if (tila.valittu.varustus.indexOf(l.id) >= 0) return;   // уже в комплекте
      s += l.per === "hlo" ? l.hinta * hlo : l.hinta;
    });
    return s;
  }

  /* ---------- карточки ---------- */
  /* Результат поиска рисуется в ту же галерею: крупная карточка в центре,
     соседние по краям. Отдельного экрана со списком нет. */
  function piirraKortit(){
    var rail = el("rail"), hero = el("hero"), uusi = el("uusiRivi");
    if (!rail) return;
    // Сбрасывать нечего, пока результата нет: кнопка нового поиска
    // появляется вместе с фотографиями и уходит вместе с ними.
    if (uusi) uusi.classList.toggle("hide", !tila.ehdokkaat.length);
    if (!tila.ehdokkaat.length) {
      rail.innerHTML = "";
      if (hero) hero.classList.add("tyhja");
      if (typeof paivitaRail === "function") paivitaRail();
      return;
    }
    rail.innerHTML = tila.ehdokkaat.map(function(o){
      var kuva = o.kuva ? '<img src="'+o.kuva+'" alt="">' : '<div class="noimg"></div>';
      var ale  = o.ale ? '<span class="off">'+o.ale+'%</span>' : '';
      return '<div class="item" data-pick="'+o.id+'">'+
        kuva + ale +
        '<span class="hinta">alk '+eurLyhyt(o.hinta_vrk)+'</span>'+
        '<div class="shade"></div>'+
        '<div class="cap"><i>'+o.alue+'</i><b>'+o.nimi+'</b></div>'+
      '</div>';
    }).join("");
    if (hero) hero.classList.remove("tyhja");
    rail.scrollLeft = 0;
    // Пересчёт на следующем кадре: до него браузер ещё не разместил
    // карточки, и центральная не определяется — все остаются притушенными.
    requestAnimationFrame(function(){
      if (typeof paivitaRail === "function") paivitaRail();
    });
  }

  function suomiPvm(s){
    var d = pvm(s); if (!d) return s || "";
    function kk(n){ return (n<10?"0":"")+n; }
    return kk(d.getDate())+"."+kk(d.getMonth()+1)+"."+d.getFullYear();
  }

  /* Карточку выбирают нажатием на неё же — отдельной кнопки нет.
     Лента на время перетаскивания забирает указатель себе
     (setPointerCapture), и click приходит НА ЛЕНТУ, а не на карточку:
     e.target всегда сама лента, и поиск по ней ничего не находил.
     Поэтому карточку ищем по координатам нажатия. */
  el("rail").addEventListener("click", function(e){
    if (window.railVeti && window.railVeti()) return;   // это было перетаскивание
    var k = (e.target && e.target.closest) ? e.target.closest(".item") : null;
    if (!k) {
      var n = document.elementFromPoint(e.clientX, e.clientY);
      k = (n && n.closest) ? n.closest(".item") : null;
    }
    if (!k) return;
    var id = k.getAttribute("data-pick");
    if (id) valitse(id);
  });

  /* Нажали фото — проваливаемся в карточку объекта, а не сразу в допы:
     по одной фотографии в ленте не решают. */
  function valitse(id){
    var o = null;
    for (var i=0;i<OBJEKTIT.length;i++) if (OBJEKTIT[i].id === id) o = OBJEKTIT[i];
    if (!o) return;
    tila.valittu = o;
    // Допы, которые гость уже называл, включаем сразу — второй раз
    // спрашивать о них незачем.
    LISAT.forEach(function(l){ if (tila.kriteerit[l.id]) tila.lisat[l.id] = true; });
    piirraKortti();
    vaihe(2);
  }

  /* Карточка объекта. Цена показана дважды: прейскурантом за сутки и за
     неделю — и счётом на названные гостем даты. Решение принимают по
     второму числу, а не по первому. */
  function piirraKortti(){
    var k = el("kortti"), o = tila.valittu;
    if (!k || !o) return;
    var yot = oita(tila.kriteerit.saapuminen, tila.kriteerit.lahto);
    var hlo = henkilomaara();

    var kuva = o.kuva ? '<img src="'+o.kuva+'" alt="">' : '<div class="noimg"></div>';
    var ale  = o.ale ? '<span class="off">'+o.ale+'%</span>' : '';

    var spec = [o.makuuhuoneet+" "+T("k_mh"),
                o.vuodepaikat+" "+T("k_vuodepaikkaa"),
                o.wc+" "+T("k_wc")]
               .map(function(s){ return '<span>'+s+'</span>'; }).join("");

    var varusteet = (o.varustus || []).map(function(v){
      return '<span>'+(T("v_"+v) || v)+'</span>';
    }).join("");

    var pvm = yot
      ? suomiPvm(tila.kriteerit.saapuminen)+" – "+suomiPvm(tila.kriteerit.lahto)+
        " · "+yot+" "+T("yota")+(hlo ? " · "+hlo+" "+T("hlo") : "")
      : "";

    k.innerHTML =
      '<div class="pic">'+kuva+ale+'</div>'+
      '<div class="body">'+
        '<b class="nimi">'+o.nimi+'</b>'+
        '<span class="alue">'+o.alue+'</span>'+
        (pvm ? '<span class="pvm">'+pvm+'</span>' : '')+
        '<div class="spec">'+spec+'</div>'+
        (varusteet
          ? '<span class="alue" style="margin-top:14px">'+T("sisaltyy_hintaan")+'</span>'+
            '<div class="varusteet">'+varusteet+'</div>'
          : '')+
        '<div class="row">'+
          '<span class="alue">'+eurLyhyt(o.hinta_vrk)+' '+T("p_vrk")+
            ' · '+eurLyhyt(o.hinta_vko)+' '+T("p_vko")+'</span>'+
          '<span class="hinta">'+
            '<small>'+(yot ? yot+" "+T("yota")+" × "+eurLyhyt(o.hinta_vrk) : T("yhteensa"))+'</small>'+
            '<b>'+eur(yot ? o.hinta_vrk*yot : o.hinta_vrk)+'</b>'+
          '</span>'+
        '</div>'+
      '</div>';
  }

  el("takaisin").addEventListener("click", function(){ vaihe(1); });
  el("toLisat").addEventListener("click", function(){ piirraLisat(); vaihe(3); });

  /* ---------- допы ---------- */
  /* Допов тридцать. Простынёй в один список их не читают, поэтому
     показываем группами, как на сайте: проживание, сауна, вода,
     рыбалка, детям, прочее. */
  function piirraLisat(){
    var hlo = henkilomaara() || 1;
    var ryhmat = [];
    LISAT.forEach(function(l){ if (ryhmat.indexOf(l.r) < 0) ryhmat.push(l.r); });

    el("lisat").innerHTML = ryhmat.map(function(r){
      var rivit = LISAT.filter(function(l){ return l.r === r; }).map(function(l){
        var kuuluu = tila.valittu && tila.valittu.varustus.indexOf(l.id) >= 0;
        var hinta;
        if (kuuluu)                   hinta = T("sisaltyy");
        else if (l.per === "paikalla")hinta = T("paikalla");
        else if (!l.hinta)            hinta = T("veloituksetta");
        else                          hinta = eur(l.per === "hlo" ? l.hinta * hlo : l.hinta);
        var on = (tila.lisat[l.id] || kuuluu) ? " on" : "";
        return '<div class="lisa">'+
          '<div class="t"><b>'+l.nimi+'</b>'+(l.alt?'<small>'+l.alt+'</small>':'')+'</div>'+
          '<span class="p">'+hinta+'</span>'+
          '<div class="sw'+on+'" data-l="'+l.id+'"'+(kuuluu?' style="opacity:.4; pointer-events:none"':'')+'></div>'+
        '</div>';
      }).join("");
      return '<div class="ryhma"><span class="lbl">'+T(r)+'</span>'+rivit+'</div>';
    }).join("");
    piirraTotal();
  }

  /* Состав группы: взрослые плюс дети. Малыши до двух лет в число мест
     на сайте не идут, поэтому и здесь не считаются. */
  function henkilomaara(){
    var a = parseInt(tila.kriteerit.aikuiset, 10) || 0;
    var l = parseInt(tila.kriteerit.lapset, 10) || 0;
    var n = a + l;
    if (!n) n = parseInt(tila.kriteerit.henkiloa, 10) || 0;
    return n;
  }

  el("lisat").addEventListener("click", function(e){
    var id = e.target.getAttribute("data-l");
    if (!id) return;
    tila.lisat[id] = !tila.lisat[id];
    piirraLisat();
  });

  function piirraTotal(){
    if (!tila.valittu) return;
    var yot = oita(tila.kriteerit.saapuminen, tila.kriteerit.lahto) || 1;
    var hlo = henkilomaara() || 1;
    var rivit = '<div class="r"><b>'+tila.valittu.nimi+'</b><span>'+eur(tila.valittu.hinta_vrk*yot)+'</span></div>'+
                '<div class="r"><b>'+yot+' yötä · '+hlo+' hlö</b><span></span></div>';
    LISAT.forEach(function(l){
      if (!tila.lisat[l.id]) return;
      if (tila.valittu.varustus.indexOf(l.id) >= 0) return;
      var h = l.per === "hlo" ? l.hinta*hlo : l.hinta;
      rivit += '<div class="r"><b>'+l.nimi+'</b><span>'+eur(h)+'</span></div>';
    });
    var html = rivit + '<div class="s"><span>' + T("yhteensa") + '</span><span>'+eur(summa())+'</span></div>';
    el("total").innerHTML = html;
    if (el("total2")) el("total2").innerHTML = html;
  }

  el("toForm").addEventListener("click", function(){
    if (tila.asiakas.nimi)    el("fName").value = tila.asiakas.nimi;
    if (tila.asiakas.sahko)   el("fMail").value = tila.asiakas.sahko;
    if (tila.asiakas.puhelin) el("fTel").value  = tila.asiakas.puhelin;
    piirraTotal();
    vaihe(4);
  });

  /* ---------- оплата: ЗАГЛУШКА ---------- */
  el("pay").addEventListener("click", function(){
    tila.asiakas.nimi    = el("fName").value.trim();
    tila.asiakas.sahko   = el("fMail").value.trim();
    tila.asiakas.puhelin = el("fTel").value.trim();
    maksuun();
  });

  function maksuun(){
    var yot = oita(tila.kriteerit.saapuminen, tila.kriteerit.lahto) || 1;
    el("okRivi").textContent = (tila.valittu ? tila.valittu.nimi : "") + " · " +
      suomiPvm(tila.kriteerit.saapuminen) + " – " + suomiPvm(tila.kriteerit.lahto) +
      " · " + yot + " yötä · " + (henkilomaara()||"?") + " hlö";
    el("okSumma").textContent = eur(summa());
    vaihe(5);
    // ЗАГЛУШКА: сюда встанет переход к платёжному провайдеру.
    // window.location.href = "https://maksu.example/..." + varausId;
  }

  /* Новый поиск. Стирается всё: критерии, разговор, результат и выбранный
     объект — экран возвращается в тот вид, с которого приложение открылось.
     Одна и та же работа для кнопки под результатом и для кнопки на экране
     подтверждения, поэтому она здесь одна. */
  function uusiHaku(){
    stopVoice();
    if(window.speechSynthesis) speechSynthesis.cancel();
    tila = { kriteerit:{}, historia:[], ehdokkaat:[], valittu:null, lisat:{}, asiakas:{}, vaihe:1 };
    el("puhelu").innerHTML = "";
    el("kysymys").innerHTML = "";
    el("say").value = "";
    piirraKortit();
    piirraEhdot();
    vaihe(1);
    aloita();
  }
  el("restart").addEventListener("click", uusiHaku);
  el("uusiHaku").addEventListener("click", uusiHaku);

  const messages={"fi": {"idle": "Paina kerran aloittaaksesi. Älä pidä painettuna.", "listening": "Kuuntelen. Puhu tai kirjoita.", "speaking": "Kuulen sinut…", "waiting": "Odota. Kirjoitan vastausta…", "searching": "Etsin mökkejä…", "results": "Hakutulokset. Aloita uusi keskustelu tai kirjoita muuttaaksesi hakua.", "aika": "Milloin tulisitte ja lähtisitte?", "alue": "Miltä alueelta?", "hinta": "Mikä on enimmäishinta yöltä?", "vieraat": "Montako aikuista ja alle 12-vuotiasta lasta?", "permission": "Mikrofonin lupa…", "loading": "Lataan puheentunnistusta…", "error": "Virhe. Yritä uudelleen."}, "en": {"idle": "Tap once to start. Do not hold.", "listening": "Listening. Speak or type.", "speaking": "I hear you…", "waiting": "Please wait. Writing a reply…", "searching": "Searching cottages…", "results": "Search results. Start a new conversation or type to change your search.", "aika": "What are your arrival and departure dates?", "alue": "Which area?", "hinta": "Maximum budget per night?", "vieraat": "How many adults and children under 12?", "permission": "Requesting microphone…", "loading": "Loading speech detection…", "error": "Error. Try again."}, "ru": {"idle": "Нажмите один раз. Не удерживайте.", "listening": "Слушаю. Говорите или пишите.", "speaking": "Слышу вас…", "waiting": "Подождите. Печатаю ответ…", "searching": "Ищу коттеджи…", "results": "Результаты поиска. Можно изменить параметры голосом.", "aika": "На какие даты планируете поездку?", "alue": "В каком районе?", "hinta": "Максимальный бюджет за ночь?", "vieraat": "Сколько взрослых и детей до 12 лет?", "permission": "Запрашиваю микрофон…", "loading": "Загружаю распознавание речи…", "error": "Ошибка. Попробуйте снова."}, "sv": {"idle": "Tryck en gång. Håll inte inne.", "listening": "Lyssnar. Tala eller skriv.", "speaking": "Jag hör dig…", "waiting": "Vänta. Skriver svar…", "searching": "Söker stugor…", "results": "Sökresultat. Starta ett nytt samtal eller skriv.", "aika": "Vilka datum?", "alue": "Vilket område?", "hinta": "Maxbudget per natt?", "vieraat": "Hur många vuxna och barn under 12?", "permission": "Begär mikrofon…", "loading": "Laddar taldetektering…", "error": "Fel. Försök igen."}, "de": {"idle": "Einmal tippen. Nicht gedrückt halten.", "listening": "Ich höre zu. Sprechen oder schreiben.", "speaking": "Ich höre Sie…", "waiting": "Bitte warten. Schreibe Antwort…", "searching": "Suche Ferienhäuser…", "results": "Suchergebnisse. Starten Sie ein Gespräch oder schreiben Sie.", "aika": "Anreise und Abreise?", "alue": "Welche Region?", "hinta": "Maximalbudget pro Nacht?", "vieraat": "Wie viele Erwachsene und Kinder unter 12?", "permission": "Mikrofonzugriff…", "loading": "Lade Spracherkennung…", "error": "Fehler. Erneut versuchen."}, "fr": {"idle": "Appuyez une fois, sans maintenir.", "listening": "Je vous écoute. Parlez ou écrivez.", "speaking": "Je vous entends…", "waiting": "Patientez. Je rédige la réponse…", "searching": "Recherche de chalets…", "results": "Résultats. Démarrez une conversation ou écrivez.", "aika": "Quelles dates d’arrivée et de départ ?", "alue": "Quelle région ?", "hinta": "Budget maximum par nuit ?", "vieraat": "Combien d’adultes et d’enfants de moins de 12 ans ?", "permission": "Accès au microphone…", "loading": "Chargement de la détection vocale…", "error": "Erreur. Réessayez."}};
  const startLabels={"fi": ["Aloita keskustelu", "Lopeta keskustelu"], "sv": ["Starta samtal", "Avsluta samtal"], "en": ["Start conversation", "End conversation"], "de": ["Gespräch starten", "Gespräch beenden"], "fr": ["Démarrer la conversation", "Terminer la conversation"], "ru": ["Начать разговор", "Завершить разговор"]};
  function labels(){return messages[el('kieli').value]||messages.fi;}
  const dialogue=new DialogueEngine(); let busy=false, currentStatus='idle';
  const voiceLog=document.createElement('pre');voiceLog.hidden=!location.search.includes('diag=1');el('st').after(voiceLog);
  function log(t){voiceLog.textContent=(new Date().toLocaleTimeString()+' '+t+'\n'+voiceLog.textContent).slice(0,12000);}
  let generation=0;
  function showStatus(state){currentStatus=state;const st=el('st');st.dataset.state=state;st.textContent=labels()[state]||labels().waiting;const names=startLabels[el('kieli').value]||startLabels.fi;el('startLabel').textContent=names[0];el('mic').setAttribute('aria-label',names[0]);el('stopVoice').textContent=names[1];el('mic').hidden=!!voice.session;el('stopVoice').hidden=!voice.session;el('mic').disabled=busy;el('send').disabled=busy||['permission','loading','speaking','waiting','searching'].includes(state);}
  const voice=new VoiceEngine({onState:showStatus,onText:submit,onLog:log,canListen:()=>!busy});
  function stopVoice(){generation++;dialogue.cancel();busy=false;void voice.stop();showStatus('idle');}
  async function submit(text){if(busy)return;busy=true;const g=generation,state=tila;tyopoyta(true);opastusPois();showStatus('waiting');puhu('me',text);let finalState;try{const d=await dialogue.turn(state,text,el('kieli').value);if(d&&state===tila&&g===generation)finalState=await kasittele(d);}catch(e){if(g===generation){log(String(e));puhu('bot',T('yhteys'));finalState='error';}}finally{if(g===generation){busy=false;showStatus(finalState||(voice.session?'listening':'idle'));}}}
  function aloita(){tyopoyta(false);puhu('bot',labels().aika);showStatus('idle');}
  function sendText(){const t=el('say').value.trim();if(!t||busy||el('send').disabled)return;el('say').value='';void submit(t);}
  el('say').addEventListener('focus',()=>tyopoyta(true));
  el('send').addEventListener('click',sendText);el('say').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendText();}});
  el('mic').addEventListener('click',()=>{if(!voice.session&&!busy){tyopoyta(true);void voice.start();}});el('stopVoice').addEventListener('click',stopVoice);window.addEventListener('pagehide',stopVoice);
  async function kasittele(d){
    d = d || {};

    // Гость сказал «начнём заново» — всё стирается тем же путём, что и
    // по кнопке. Отдельной ветки у голоса нет.
    if (d.nollaa) { uusiHaku(); return; }
    const previous=SearchController.key(tila.kriteerit); const activeGeneration=generation;
    tila.kriteerit = SearchController.apply(tila.kriteerit, d.kriteerit);
    if (d.asiakas) Object.keys(d.asiakas).forEach(function(k){
      if (d.asiakas[k]) tila.asiakas[k] = d.asiakas[k];
    });
    piirraChips();

    // Разобранное показывают четыре параметра под панелью — второй раз
    // в ленте оно не нужно.

    const missing=SearchController.missing(tila.kriteerit);
    const changed=previous!==SearchController.key(tila.kriteerit);
    const validChoice=tila.ehdokkaat.some(o=>o.id===d.valinta);
    if(!missing && !d.clarify && validChoice && !changed){await voice.stop();if(activeGeneration===generation)valitse(d.valinta);return "results";}
    if(!missing && !d.clarify && (changed || !tila.searched)){
      showStatus('searching');
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      if(activeGeneration!==generation)return;
      etsi(); piirraKortit(); tila.searched=true; tyopoyta(false);
      if(tila.vaihe===2)vaihe(1);
      await voice.stop();
      if(activeGeneration!==generation)return;
      const answer=labels().results;
      puhu('bot',answer);tila.historia.push({role:'model',parts:[{text:answer}]});
      return 'results';
    }
    if(missing || d.clarify)tila.searched=false;
    const answer=d.kysymys||(missing?labels()[missing]:labels().results);
    puhu('bot',answer);tila.historia.push({role:'model',parts:[{text:answer}]});
  }
  /* ---------- галерея ----------
     Перенесено с visuals.ai-craft-studio.com без изменений в логике.
     Что здесь важно и чего я сам не сделал бы:
       setActive  — центральная карточка получает класс active: размер,
                    яркость и подпись. Соседние притушены.
       стрелки    — направление как у них: левая листает ВПЕРЁД.
       колесо     — замок на 420 мс, иначе одно движение пролистывает всё.
       перетаскивание — только мышью. У касания e.pointerType === "touch"
                    и мы не вмешиваемся: там работает родная прокрутка. */
  (function(){
    var rail = el("rail");
    if (!rail) return;
    var prev = el("prev"), next = el("next"), laskuri = el("laskuri");
    // Карточки появляются после поиска, поэтому список берём заново
    // при каждом обращении, а не один раз при загрузке.
    var items = [], total = 0;
    function lue(){
      items = rail.querySelectorAll(".item");
      total = items.length;
    }
    lue();

    function current(){
      var mid = rail.scrollLeft + rail.clientWidth / 2;
      var best = 0, bestD = Infinity;
      for (var i = 0; i < total; i++){
        var c = items[i].offsetLeft + items[i].offsetWidth / 2;
        var d = Math.abs(c - mid);
        if (d < bestD){ bestD = d; best = i; }
      }
      return best;
    }

    function goTo(i){
      if (i < 0) i = 0;
      if (i > total - 1) i = total - 1;
      var it = items[i];
      rail.scrollTo({ left: it.offsetLeft - (rail.clientWidth - it.offsetWidth) / 2,
                      behavior: "smooth" });
    }

    var activeIdx = -1;
    function setActive(i){
      if (i === activeIdx) return;
      activeIdx = i;
      for (var k = 0; k < total; k++){
        if (k === i) items[k].classList.add("active");
        else         items[k].classList.remove("active");
      }
    }

    function refresh(){
      if (!total) {
        // Результата ещё нет — подпись остаётся, цифр в ней нет.
        if (laskuri) laskuri.innerHTML = '<span class="merkki">' + T("hakutulos") + '</span>';
        return;
      }
      var i = current();
      setActive(i);
      // Подпись говорит, что это результат поиска, а не картинки
      // для красоты. Пока объекты заглушечные, слово то же.
      if (laskuri) laskuri.innerHTML = '<span class="merkki">' + T("hakutulos") + '<b>' +
        (i + 1) + "/" + total + "</b></span>";
      if (prev) prev.disabled = rail.scrollLeft > rail.scrollWidth - rail.clientWidth - 4;
      if (next) next.disabled = rail.scrollLeft < 4;
    }

    rail.addEventListener("scroll", refresh, {passive:true});
    window.addEventListener("resize", refresh);
    refresh();

    // Вызывается после отрисовки результата поиска.
    window.paivitaRail = function(){ lue(); activeIdx = -1; refresh(); };

    /* стрелка = направление движения ленты */
    if (prev) prev.addEventListener("click", function(){ goTo(current() + 1); });
    if (next) next.addEventListener("click", function(){ goTo(current() - 1); });

    var wheelLock = false;
    rail.addEventListener("wheel", function(e){
      var dy = Math.abs(e.deltaY), dx = Math.abs(e.deltaX);
      if (dx > dy) return;
      if (dy < 2) return;
      e.preventDefault();
      if (wheelLock) return;
      wheelLock = true;
      goTo(current() + (e.deltaY > 0 ? 1 : -1));
      setTimeout(function(){ wheelLock = false; }, 420);
    }, {passive:false});

    var down = false, startX = 0, startLeft = 0, moved = 0;
    // Перетащили — значит листали, а не выбирали. Выбор об этом спрашивает.
    window.railVeti = function(){ return moved > 8; };
    rail.addEventListener("pointerdown", function(e){
      if (e.pointerType === "touch") { moved = 0; return; }
      down = true; moved = 0;
      startX = e.clientX;
      startLeft = rail.scrollLeft;
      rail.classList.add("dragging");
      rail.setPointerCapture(e.pointerId);
    });
    rail.addEventListener("pointermove", function(e){
      if (!down) return;
      var d = e.clientX - startX;
      moved = Math.abs(d);
      rail.scrollLeft = startLeft - d;
    });
    function endDrag(e){
      if (!down) return;
      down = false;
      rail.classList.remove("dragging");
      if (e && e.pointerId != null && rail.hasPointerCapture && rail.hasPointerCapture(e.pointerId)) {
        rail.releasePointerCapture(e.pointerId);
      }
      if (moved > 8) goTo(current());
    }
    rail.addEventListener("pointerup", endDrag);
    rail.addEventListener("pointercancel", endDrag);

    rail.setAttribute("tabindex", "0");
    rail.addEventListener("keydown", function(e){
      if (e.key === "ArrowLeft"){  e.preventDefault(); goTo(current() + 1); }
      if (e.key === "ArrowRight"){ e.preventDefault(); goTo(current() - 1); }
    });
  })();

  if (el("kieli")) el("kieli").addEventListener("change", function(){
    kieli = this.value;
    document.documentElement.setAttribute("lang", kieli);
    kaanna(); showStatus(currentStatus);
  });

  /* Карта встаёт посередине между подписью и вопросом — зазоры сверху
     и снизу одинаковые на любом экране. */
  function asetaKartta(){
    var k = document.querySelector(".kartta");
    var yla = el("laskuri");
    var ala = el("kysymys");
    if (!k || !yla || !ala) return;
    var a = yla.getBoundingClientRect().bottom;
    var b = ala.getBoundingClientRect().top;
    var h = k.getBoundingClientRect().height;
    var tila_ = b - a;
    k.style.top = Math.round(a + (tila_ - h) / 2) + "px";
  }
  window.addEventListener("resize", asetaKartta);
  var _vanhaVaihe = vaihe;
  vaihe = function(n){ _vanhaVaihe(n); requestAnimationFrame(asetaKartta); };

  kaanna();
  piirraChips(); vaihe(1); aloita();
  requestAnimationFrame(asetaKartta);
})();
