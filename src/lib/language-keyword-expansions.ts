import type { LanguageId } from "@/types/language";
import type { KeywordEntry, PhonemeData } from "@/types/phoneme";
import { LANGUAGE_LEARNING_DECKS } from "@/lib/language-learning-decks";
import type { DeckLanguageId } from "@/lib/language-learning-decks";

const MIN_KEYWORD_OPTIONS_PER_UNIT = 24;
const MIN_DIVERSE_KEYWORD_OPTIONS_PER_UNIT = 20;
const MAX_KEYWORD_OPTIONS_PER_UNIT = 24;
const PRACTICE_TOKEN_REPEAT_LIMIT = 3;

const TOKEN_STOP_WORDS = new Set([
  "a",
  "au",
  "aux",
  "avec",
  "con",
  "dans",
  "de",
  "del",
  "des",
  "du",
  "el",
  "elle",
  "en",
  "et",
  "i",
  "il",
  "la",
  "le",
  "les",
  "mi",
  "moi",
  "no",
  "por",
  "que",
  "qui",
  "se",
  "tu",
  "un",
  "una",
  "une",
  "y",
  "yo",
  "в",
  "и",
  "к",
  "на",
  "но",
  "с",
  "у",
  "я",
]);

const RUSSIAN_DECK_STRESS_TEXT: Record<string, string> = {
  "дома": "до́ма",
  "дуба": "ду́ба",
};

const EXTRA_KEYWORD_OPTIONS: Partial<Record<LanguageId, Record<string, KeywordEntry[]>>> = {
  "es-ES": {
    "es-a": [
      { word: "cama", ipa: "/ˈkama/" },
      { word: "padre", ipa: "/ˈpaðɾe/" },
      { word: "tarde", ipa: "/ˈtaɾðe/" },
      { word: "playa", ipa: "/ˈplaʝa/" },
      { word: "pan", ipa: "/pan/" },
      { word: "gato", ipa: "/ˈgato/" },
      { word: "barato", ipa: "/baˈɾato/" },
      { word: "palabra", ipa: "/paˈlaβɾa/" },
      { word: "mañana", ipa: "/maˈɲana/" },
      { word: "España", ipa: "/esˈpaɲa/" },
      { word: "familia", ipa: "/faˈmilja/" },
      { word: "trabajo", ipa: "/tɾaˈβaxo/" },
      { word: "hablar", ipa: "/aˈβlaɾ/" },
      { word: "plaza", ipa: "/ˈplaθa/" },
      { word: "carta", ipa: "/ˈkaɾta/" },
      { word: "alma", ipa: "/ˈalma/" },
      { word: "arena", ipa: "/aˈɾena/" },
      { word: "mercado", ipa: "/meɾˈkaðo/" },
    ],
    "es-e": [
      { word: "escuela", ipa: "/esˈkwela/" },
      { word: "este", ipa: "/ˈeste/" },
      { word: "teléfono", ipa: "/teˈlefono/" },
      { word: "comer", ipa: "/koˈmeɾ/" },
      { word: "beber", ipa: "/beˈβeɾ/" },
      { word: "cerca", ipa: "/ˈθeɾka/" },
      { word: "mujer", ipa: "/muˈxeɾ/" },
      { word: "enero", ipa: "/eˈneɾo/" },
      { word: "señor", ipa: "/seˈɲoɾ/" },
      { word: "queso", ipa: "/ˈkeso/" },
      { word: "ayer", ipa: "/aˈʝeɾ/" },
      { word: "cena", ipa: "/ˈθena/" },
      { word: "lección", ipa: "/lekˈθjon/" },
      { word: "veinte", ipa: "/ˈbeinte/" },
      { word: "leer", ipa: "/leˈeɾ/" },
      { word: "tren", ipa: "/tɾen/" },
      { word: "mesa grande", ipa: "/ˈmesa ˈgɾande/" },
      { word: "tres veces", ipa: "/tɾes ˈbeθes/" },
    ],
    "es-i": [
      { word: "listo", ipa: "/ˈlisto/" },
      { word: "difícil", ipa: "/diˈfiθil/" },
      { word: "vivir", ipa: "/biˈβiɾ/" },
      { word: "pedir", ipa: "/peˈðiɾ/" },
      { word: "chico", ipa: "/ˈtʃiko/" },
      { word: "aquí", ipa: "/aˈki/" },
      { word: "limpio", ipa: "/ˈlimpjo/" },
      { word: "iglesia", ipa: "/iˈɣlesja/" },
      { word: "escribir", ipa: "/eskɾiˈβiɾ/" },
      { word: "príncipe", ipa: "/ˈpɾinθipe/" },
      { word: "feliz", ipa: "/feˈliθ/" },
      { word: "mil", ipa: "/mil/" },
      { word: "isla", ipa: "/ˈisla/" },
      { word: "tiempo", ipa: "/ˈtjempo/" },
      { word: "línea", ipa: "/ˈlinea/" },
      { word: "minuto", ipa: "/miˈnuto/" },
      { word: "cita", ipa: "/ˈθita/" },
      { word: "mi amigo", ipa: "/mi aˈmiɣo/" },
    ],
    "es-o": [
      { word: "noche", ipa: "/ˈnotʃe/" },
      { word: "poco", ipa: "/ˈpoko/" },
      { word: "solo", ipa: "/ˈsolo/" },
      { word: "flor", ipa: "/floɾ/" },
      { word: "color", ipa: "/koˈloɾ/" },
      { word: "otoño", ipa: "/oˈtoɲo/" },
      { word: "entonces", ipa: "/enˈtonθes/" },
      { word: "comprar", ipa: "/komˈpɾaɾ/" },
      { word: "otro", ipa: "/ˈotɾo/" },
      { word: "oro", ipa: "/ˈoɾo/" },
      { word: "corto", ipa: "/ˈkoɾto/" },
      { word: "foto", ipa: "/ˈfoto/" },
      { word: "domingo", ipa: "/doˈmingo/" },
      { word: "octubre", ipa: "/okˈtuβɾe/" },
      { word: "profesor", ipa: "/pɾofeˈsoɾ/" },
      { word: "corazón", ipa: "/koɾaˈθon/" },
      { word: "dos ojos", ipa: "/dos ˈoxos/" },
      { word: "como todo", ipa: "/ˈkomo ˈtoðo/" },
    ],
    "es-u": [
      { word: "música", ipa: "/ˈmusika/" },
      { word: "usted", ipa: "/usˈteð/" },
      { word: "mucho", ipa: "/ˈmutʃo/" },
      { word: "jueves", ipa: "/ˈxweβes/" },
      { word: "puerta", ipa: "/ˈpweɾta/" },
      { word: "fuerte", ipa: "/ˈfweɾte/" },
      { word: "dulce", ipa: "/ˈdulθe/" },
      { word: "grupo", ipa: "/ˈgɾupo/" },
      { word: "lluvia", ipa: "/ˈʝuβja/" },
      { word: "cultura", ipa: "/kulˈtuɾa/" },
      { word: "julio", ipa: "/ˈxuljo/" },
      { word: "seguro", ipa: "/seˈɣuɾo/" },
      { word: "puente", ipa: "/ˈpwente/" },
      { word: "ruido", ipa: "/ˈrwiðo/" },
      { word: "suerte", ipa: "/ˈsweɾte/" },
      { word: "último", ipa: "/ˈultimo/" },
      { word: "tu curso", ipa: "/tu ˈkuɾso/" },
      { word: "una luna", ipa: "/ˈuna ˈluna/" },
    ],
    "es-bv": [
      { word: "bueno", ipa: "/ˈbweno/" },
      { word: "valor", ipa: "/baˈloɾ/" },
      { word: "vaca", ipa: "/ˈbaka/" },
      { word: "banco", ipa: "/ˈbanko/" },
      { word: "bravo", ipa: "/ˈbɾaβo/" },
      { word: "volver", ipa: "/bolˈβeɾ/" },
      { word: "vivir", ipa: "/biˈβiɾ/" },
      { word: "avión", ipa: "/aˈβjon/" },
      { word: "barco", ipa: "/ˈbaɾko/" },
      { word: "verano", ipa: "/beˈɾano/" },
      { word: "novia", ipa: "/ˈnoβja/" },
      { word: "hablar", ipa: "/aˈβlaɾ/" },
      { word: "cabeza", ipa: "/kaˈβeθa/" },
      { word: "favor", ipa: "/faˈβoɾ/" },
      { word: "buscar", ipa: "/busˈkaɾ/" },
      { word: "sábado", ipa: "/ˈsaβaðo/" },
      { word: "mi vida", ipa: "/mi ˈbiða/" },
      { word: "la boca", ipa: "/la ˈboka/" },
    ],
    "es-d": [
      { word: "dama", ipa: "/ˈdama/" },
      { word: "domingo", ipa: "/doˈmingo/" },
      { word: "andar", ipa: "/anˈdaɾ/" },
      { word: "ciudad", ipa: "/θjuˈðað/" },
      { word: "Madrid", ipa: "/maˈðɾið/" },
      { word: "medio", ipa: "/ˈmeðjo/" },
      { word: "ayuda", ipa: "/aˈʝuða/" },
      { word: "comida", ipa: "/koˈmiða/" },
      { word: "tarde", ipa: "/ˈtaɾðe/" },
      { word: "adiós", ipa: "/aˈðjos/" },
      { word: "dormir", ipa: "/doɾˈmiɾ/" },
      { word: "desde", ipa: "/ˈdezðe/" },
      { word: "cuidado", ipa: "/kwiˈðaðo/" },
      { word: "delgado", ipa: "/delˈɣaðo/" },
      { word: "verdad", ipa: "/beɾˈðað/" },
      { word: "doctor", ipa: "/dokˈtoɾ/" },
      { word: "un día", ipa: "/un ˈdia/" },
      { word: "la duda", ipa: "/la ˈduða/" },
    ],
    "es-g": [
      { word: "guerra", ipa: "/ˈgera/" },
      { word: "guitarra", ipa: "/giˈtara/" },
      { word: "gol", ipa: "/gol/" },
      { word: "gobierno", ipa: "/goˈβjeɾno/" },
      { word: "lengua", ipa: "/ˈlengwa/" },
      { word: "pagar", ipa: "/paˈɣaɾ/" },
      { word: "seguir", ipa: "/seˈɣiɾ/" },
      { word: "regalo", ipa: "/reˈɣalo/" },
      { word: "llegar", ipa: "/ʝeˈɣaɾ/" },
      { word: "agosto", ipa: "/aˈɣosto/" },
      { word: "colegio", ipa: "/koˈlexjo/" },
      { word: "gota", ipa: "/ˈgota/" },
      { word: "gusto", ipa: "/ˈgusto/" },
      { word: "guardar", ipa: "/gwaɾˈðaɾ/" },
      { word: "gris", ipa: "/gɾis/" },
      { word: "jugar", ipa: "/xuˈɣaɾ/" },
      { word: "luego", ipa: "/ˈlweɣo/" },
      { word: "higo", ipa: "/ˈiɣo/" },
    ],
    "es-theta": [
      { word: "cena", ipa: "/ˈθena/" },
      { word: "cerveza", ipa: "/θeɾˈβeθa/" },
      { word: "zona", ipa: "/ˈθona/" },
      { word: "azúcar", ipa: "/aˈθukaɾ/" },
      { word: "lápiz", ipa: "/ˈlapiθ/" },
      { word: "corazón", ipa: "/koɾaˈθon/" },
      { word: "once", ipa: "/ˈonθe/" },
      { word: "doce", ipa: "/ˈdoθe/" },
      { word: "trece", ipa: "/ˈtɾeθe/" },
      { word: "fácil", ipa: "/ˈfaθil/" },
      { word: "ciudad", ipa: "/θjuˈðað/" },
      { word: "voz", ipa: "/boθ/" },
      { word: "cero", ipa: "/ˈθeɾo/" },
      { word: "hacia", ipa: "/ˈaθja/" },
      { word: "zapatería", ipa: "/θapateˈɾia/" },
      { word: "diez", ipa: "/djeθ/" },
      { word: "cien euros", ipa: "/θjen ˈewɾos/" },
      { word: "zona azul", ipa: "/ˈθona aˈθul/" },
    ],
    "es-x": [
      { word: "jardín", ipa: "/xaɾˈðin/" },
      { word: "jota", ipa: "/ˈxota/" },
      { word: "jefe", ipa: "/ˈxefe/" },
      { word: "caja", ipa: "/ˈkaxa/" },
      { word: "hoja", ipa: "/ˈoxa/" },
      { word: "ajo", ipa: "/ˈaxo/" },
      { word: "mujer", ipa: "/muˈxeɾ/" },
      { word: "jueves", ipa: "/ˈxweβes/" },
      { word: "eje", ipa: "/ˈexe/" },
      { word: "traje", ipa: "/ˈtɾaxe/" },
      { word: "lejos", ipa: "/ˈlexos/" },
      { word: "bajo", ipa: "/ˈbaxo/" },
      { word: "viajar", ipa: "/bjaˈxaɾ/" },
      { word: "naranja", ipa: "/naˈɾanxa/" },
      { word: "ejemplo", ipa: "/eˈxemplo/" },
      { word: "reloj", ipa: "/reˈlox/" },
      { word: "José juega", ipa: "/xoˈse ˈxweɣa/" },
      { word: "caja roja", ipa: "/ˈkaxa ˈroxa/" },
    ],
    "es-ny": [
      { word: "año", ipa: "/ˈaɲo/" },
      { word: "español", ipa: "/espaˈɲol/" },
      { word: "pequeño", ipa: "/peˈkeɲo/" },
      { word: "señora", ipa: "/seˈɲoɾa/" },
      { word: "sueño", ipa: "/ˈsweɲo/" },
      { word: "baño", ipa: "/ˈbaɲo/" },
      { word: "cariño", ipa: "/kaˈɾiɲo/" },
      { word: "montaña", ipa: "/monˈtaɲa/" },
      { word: "campaña", ipa: "/kamˈpaɲa/" },
      { word: "señal", ipa: "/seˈɲal/" },
      { word: "muñeca", ipa: "/muˈɲeka/" },
      { word: "piñata", ipa: "/piˈɲata/" },
      { word: "leña", ipa: "/ˈleɲa/" },
      { word: "uña", ipa: "/ˈuɲa/" },
      { word: "daño", ipa: "/ˈdaɲo/" },
      { word: "niñez", ipa: "/niˈɲeθ/" },
      { word: "mi niño", ipa: "/mi ˈniɲo/" },
      { word: "un año", ipa: "/un ˈaɲo/" },
    ],
    "es-tap-r": [
      { word: "pero", ipa: "/ˈpeɾo/" },
      { word: "caro", ipa: "/ˈkaɾo/" },
      { word: "para", ipa: "/ˈpaɾa/" },
      { word: "puerta", ipa: "/ˈpweɾta/" },
      { word: "verde", ipa: "/ˈbeɾðe/" },
      { word: "brazo", ipa: "/ˈbɾaθo/" },
      { word: "pera", ipa: "/ˈpeɾa/" },
      { word: "barato", ipa: "/baˈɾato/" },
      { word: "primero", ipa: "/pɾiˈmeɾo/" },
      { word: "claro", ipa: "/ˈklaɾo/" },
      { word: "fruta", ipa: "/ˈfɾuta/" },
      { word: "trabajo", ipa: "/tɾaˈβaxo/" },
      { word: "drama", ipa: "/ˈdɾama/" },
      { word: "abril", ipa: "/aˈβɾil/" },
      { word: "problema", ipa: "/pɾoˈβlema/" },
      { word: "hermano", ipa: "/eɾˈmano/" },
      { word: "ahora", ipa: "/aˈoɾa/" },
      { word: "morir", ipa: "/moˈɾiɾ/" },
    ],
    "es-trill-r": [
      { word: "rosa", ipa: "/ˈrosa/" },
      { word: "ropa", ipa: "/ˈropa/" },
      { word: "rueda", ipa: "/ˈrweða/" },
      { word: "barrio", ipa: "/ˈbarjo/" },
      { word: "rata", ipa: "/ˈrata/" },
      { word: "rey", ipa: "/rei/" },
      { word: "radio", ipa: "/ˈraðjo/" },
      { word: "arriba", ipa: "/aˈriba/" },
      { word: "correo", ipa: "/koˈreo/" },
      { word: "guitarra", ipa: "/giˈtara/" },
      { word: "ferrocarril", ipa: "/ferokaˈril/" },
      { word: "enredo", ipa: "/enˈredo/" },
      { word: "subrayar", ipa: "/suβraˈʝaɾ/" },
      { word: "Israel", ipa: "/israˈel/" },
      { word: "honrado", ipa: "/onˈrado/" },
      { word: "romper", ipa: "/romˈpeɾ/" },
      { word: "carretera", ipa: "/kareˈteɾa/" },
      { word: "rojo rápido", ipa: "/ˈroxo ˈrapiðo/" },
    ],
    "es-s": [
      { word: "seis", ipa: "/seis/" },
      { word: "sopa", ipa: "/ˈsopa/" },
      { word: "sala", ipa: "/ˈsala/" },
      { word: "siempre", ipa: "/ˈsjempɾe/" },
    ],
    "es-diphthongs-j": [
      { word: "tiene tiempo", ipa: "/ˈtjene ˈtjempo/" },
      { word: "cielo claro", ipa: "/ˈθjelo ˈklaɾo/" },
      { word: "piedra pequeña", ipa: "/ˈpjeðɾa peˈkeɲa/" },
      { word: "viaje diario", ipa: "/ˈbjaxe ˈdjaɾjo/" },
      { word: "familia limpia", ipa: "/faˈmilja ˈlimpja/" },
      { word: "radio antiguo", ipa: "/ˈraðjo anˈtiɣwo/" },
    ],
    "es-diphthongs-w": [
      { word: "puerta nueva", ipa: "/ˈpweɾta ˈnweβa/" },
      { word: "fuego suave", ipa: "/ˈfweɣo ˈswaβe/" },
      { word: "buena suerte", ipa: "/ˈbwena ˈsweɾte/" },
      { word: "cuatro huevos", ipa: "/ˈkwatɾo ˈweβos/" },
      { word: "agua buena", ipa: "/ˈaɣwa ˈbwena/" },
      { word: "suelo fuerte", ipa: "/ˈswelo ˈfweɾte/" },
      { word: "cuando vuelva", ipa: "/ˈkwando ˈbwelβa/" },
      { word: "nueve puertas", ipa: "/ˈnweβe ˈpweɾtas/" },
    ],
    "es-lexical-stress": [
      { word: "camino caminó", ipa: "/kaˈmino kamiˈno/" },
      { word: "hablo habló", ipa: "/ˈaβlo aˈβlo/" },
      { word: "medico médico", ipa: "/meˈðiko ˈmeðiko/" },
      { word: "numero número", ipa: "/nuˈmeɾo ˈnumeɾo/" },
      { word: "papa y papá", ipa: "/ˈpapa i paˈpa/" },
      { word: "practico practicó", ipa: "/pɾakˈtiko pɾaktiˈko/" },
      { word: "termino terminó", ipa: "/teɾˈmino teɾmiˈno/" },
    ],
    "es-syllable-rhythm": [
      { word: "sábado", ipa: "/ˈsaβaðo/" },
      { word: "camino", ipa: "/kaˈmino/" },
      { word: "rápido", ipa: "/ˈrapiðo/" },
      { word: "tomate", ipa: "/toˈmate/" },
      { word: "banana", ipa: "/baˈnana/" },
      { word: "minuto", ipa: "/miˈnuto/" },
    ],
  },
  "fr-FR": {
    "fr-i": [
      { word: "fini", ipa: "/fini/" },
      { word: "ami", ipa: "/ami/" },
      { word: "vie", ipa: "/vi/" },
      { word: "riz", ipa: "/ʁi/" },
      { word: "type", ipa: "/tip/" },
      { word: "minute", ipa: "/minyt/" },
      { word: "machine", ipa: "/maʃin/" },
      { word: "Paris", ipa: "/paʁi/" },
      { word: "souris", ipa: "/suʁi/" },
      { word: "dire", ipa: "/diʁ/" },
      { word: "visite", ipa: "/vizit/" },
      { word: "cil", ipa: "/sil/" },
      { word: "hiver", ipa: "/ivɛʁ/" },
      { word: "livre", ipa: "/livʁ/" },
      { word: "fille", ipa: "/fij/" },
      { word: "dix", ipa: "/dis/" },
      { word: "ici vite", ipa: "/isi vit/" },
      { word: "Paris midi", ipa: "/paʁi midi/" },
    ],
    "fr-y": [
      { word: "sucre", ipa: "/sykʁ/" },
      { word: "pur", ipa: "/pyʁ/" },
      { word: "utile", ipa: "/ytil/" },
      { word: "une", ipa: "/yn/" },
      { word: "dû", ipa: "/dy/" },
      { word: "vue", ipa: "/vy/" },
      { word: "jus", ipa: "/ʒy/" },
      { word: "jupe", ipa: "/ʒyp/" },
      { word: "bureau", ipa: "/byʁo/" },
      { word: "perdu", ipa: "/pɛʁdy/" },
      { word: "salut", ipa: "/saly/" },
      { word: "minuit", ipa: "/minɥi/" },
      { word: "culture", ipa: "/kyltyʁ/" },
      { word: "menu", ipa: "/məny/" },
      { word: "début", ipa: "/deby/" },
      { word: "figure", ipa: "/figyʁ/" },
      { word: "tu peux", ipa: "/ty pø/" },
      { word: "rue du sud", ipa: "/ʁy dy syd/" },
    ],
    "fr-u": [
      { word: "beaucoup", ipa: "/boku/" },
      { word: "où", ipa: "/u/" },
      { word: "coup", ipa: "/ku/" },
      { word: "doux", ipa: "/du/" },
      { word: "lourd", ipa: "/luʁ/" },
      { word: "trou", ipa: "/tʁu/" },
      { word: "poule", ipa: "/pul/" },
      { word: "outil", ipa: "/uti/" },
      { word: "roue", ipa: "/ʁu/" },
      { word: "bouche", ipa: "/buʃ/" },
      { word: "couleur", ipa: "/kulœʁ/" },
      { word: "cou", ipa: "/ku/" },
      { word: "goût", ipa: "/gu/" },
      { word: "fou", ipa: "/fu/" },
      { word: "route", ipa: "/ʁut/" },
      { word: "douze", ipa: "/duz/" },
      { word: "vous tous", ipa: "/vu tu/" },
      { word: "sous la roue", ipa: "/su la ʁu/" },
    ],
    "fr-e": [
      { word: "aller", ipa: "/ale/" },
      { word: "clé", ipa: "/kle/" },
      { word: "musée", ipa: "/myze/" },
      { word: "journée", ipa: "/ʒuʁne/" },
      { word: "école", ipa: "/ekɔl/" },
      { word: "télé", ipa: "/tele/" },
      { word: "déjeuner", ipa: "/deʒœne/" },
      { word: "chez", ipa: "/ʃe/" },
      { word: "beauté", ipa: "/bote/" },
      { word: "février", ipa: "/fevʁije/" },
      { word: "et", ipa: "/e/" },
      { word: "marché", ipa: "/maʁʃe/" },
      { word: "entrée", ipa: "/ɑ̃tʁe/" },
      { word: "idée", ipa: "/ide/" },
      { word: "écouter", ipa: "/ekute/" },
      { word: "demander", ipa: "/dəmɑ̃de/" },
      { word: "café serré", ipa: "/kafe seʁe/" },
      { word: "parler été", ipa: "/paʁle ete/" },
    ],
    "fr-e-open": [
      { word: "père", ipa: "/pɛʁ/" },
      { word: "lait", ipa: "/lɛ/" },
      { word: "jamais", ipa: "/ʒamɛ/" },
      { word: "aime", ipa: "/ɛm/" },
      { word: "chaise", ipa: "/ʃɛz/" },
      { word: "mettre", ipa: "/mɛtʁ/" },
      { word: "mer", ipa: "/mɛʁ/" },
      { word: "hier", ipa: "/jɛʁ/" },
      { word: "clair", ipa: "/klɛʁ/" },
      { word: "cher", ipa: "/ʃɛʁ/" },
      { word: "après", ipa: "/apʁɛ/" },
      { word: "mais", ipa: "/mɛ/" },
      { word: "français", ipa: "/fʁɑ̃sɛ/" },
      { word: "elle", ipa: "/ɛl/" },
      { word: "tête", ipa: "/tɛt/" },
      { word: "crème", ipa: "/kʁɛm/" },
      { word: "très belle", ipa: "/tʁɛ bɛl/" },
      { word: "mère claire", ipa: "/mɛʁ klɛʁ/" },
    ],
    "fr-eu-close": [
      { word: "ceux", ipa: "/sø/" },
      { word: "eux", ipa: "/ø/" },
      { word: "mieux", ipa: "/mjø/" },
      { word: "œufs", ipa: "/ø/" },
      { word: "vœu", ipa: "/vø/" },
      { word: "creux", ipa: "/kʁø/" },
      { word: "queue", ipa: "/kø/" },
      { word: "veut", ipa: "/vø/" },
      { word: "peux", ipa: "/pø/" },
      { word: "jeûne", ipa: "/ʒøn/" },
      { word: "Europe", ipa: "/øʁɔp/" },
      { word: "neveu", ipa: "/nəvø/" },
      { word: "jeudi", ipa: "/ʒødi/" },
      { word: "meute", ipa: "/møt/" },
      { word: "cheveux", ipa: "/ʃəvø/" },
      { word: "creuser", ipa: "/kʁøze/" },
      { word: "deux jeux", ipa: "/dø ʒø/" },
      { word: "peu bleu", ipa: "/pø blø/" },
      { word: "ceux heureux", ipa: "/søzøʁø/" },
    ],
    "fr-eu-open": [
      { word: "cœur", ipa: "/kœʁ/" },
      { word: "bœuf", ipa: "/bœf/" },
      { word: "œuvre", ipa: "/œvʁ/" },
      { word: "heure", ipa: "/œʁ/" },
      { word: "beurre", ipa: "/bœʁ/" },
      { word: "leur", ipa: "/lœʁ/" },
      { word: "pleure", ipa: "/plœʁ/" },
      { word: "meuble", ipa: "/mœbl/" },
      { word: "œil", ipa: "/œj/" },
      { word: "fauteuil", ipa: "/fotœj/" },
      { word: "chœur", ipa: "/kœʁ/" },
      { word: "seulement", ipa: "/sœlmɑ̃/" },
      { word: "accueil", ipa: "/akœj/" },
      { word: "veulent", ipa: "/vœl/" },
      { word: "peuple", ipa: "/pœpl/" },
      { word: "jeune sœur", ipa: "/ʒœn sœʁ/" },
      { word: "beurre seul", ipa: "/bœʁ sœl/" },
      { word: "cœur neuf", ipa: "/kœʁ nœf/" },
    ],
    "fr-an": [
      { word: "enfant", ipa: "/ɑ̃fɑ̃/" },
      { word: "français", ipa: "/fʁɑ̃sɛ/" },
      { word: "ensemble", ipa: "/ɑ̃sɑ̃bl/" },
      { word: "pendant", ipa: "/pɑ̃dɑ̃/" },
      { word: "chanson", ipa: "/ʃɑ̃sɔ̃/" },
      { word: "blanc", ipa: "/blɑ̃/" },
      { word: "comment", ipa: "/kɔmɑ̃/" },
      { word: "lent", ipa: "/lɑ̃/" },
      { word: "encore", ipa: "/ɑ̃kɔʁ/" },
      { word: "vendredi", ipa: "/vɑ̃dʁədi/" },
      { word: "pantalon", ipa: "/pɑ̃talɔ̃/" },
      { word: "banque", ipa: "/bɑ̃k/" },
      { word: "apprendre", ipa: "/apʁɑ̃dʁ/" },
      { word: "entendre", ipa: "/ɑ̃tɑ̃dʁ/" },
      { word: "grand", ipa: "/gʁɑ̃/" },
      { word: "important", ipa: "/ɛ̃pɔʁtɑ̃/" },
      { word: "dans la France", ipa: "/dɑ̃ la fʁɑ̃s/" },
      { word: "un enfant", ipa: "/œ̃nɑ̃fɑ̃/" },
    ],
    "fr-in": [
      { word: "demain", ipa: "/dəmɛ̃/" },
      { word: "train", ipa: "/tʁɛ̃/" },
      { word: "jardin", ipa: "/ʒaʁdɛ̃/" },
      { word: "copain", ipa: "/kɔpɛ̃/" },
      { word: "ancien", ipa: "/ɑ̃sjɛ̃/" },
      { word: "loin", ipa: "/lwɛ̃/" },
      { word: "besoin", ipa: "/bəzwɛ̃/" },
      { word: "moins", ipa: "/mwɛ̃/" },
      { word: "rien", ipa: "/ʁjɛ̃/" },
      { word: "juin", ipa: "/ʒɥɛ̃/" },
      { word: "moyen", ipa: "/mwajɛ̃/" },
      { word: "plein", ipa: "/plɛ̃/" },
      { word: "chemin", ipa: "/ʃəmɛ̃/" },
      { word: "lendemain", ipa: "/lɑ̃dəmɛ̃/" },
      { word: "écrivain", ipa: "/ekʁivɛ̃/" },
      { word: "serein", ipa: "/səʁɛ̃/" },
      { word: "vin blanc", ipa: "/vɛ̃ blɑ̃/" },
      { word: "pain du matin", ipa: "/pɛ̃ dy matɛ̃/" },
    ],
    "fr-on": [
      { word: "rond", ipa: "/ʁɔ̃/" },
      { word: "ton", ipa: "/tɔ̃/" },
      { word: "maison", ipa: "/mɛzɔ̃/" },
      { word: "pardon", ipa: "/paʁdɔ̃/" },
      { word: "ballon", ipa: "/balɔ̃/" },
      { word: "question", ipa: "/kɛstjɔ̃/" },
      { word: "façon", ipa: "/fasɔ̃/" },
      { word: "garçon", ipa: "/gaʁsɔ̃/" },
      { word: "raison", ipa: "/ʁɛzɔ̃/" },
      { word: "saison", ipa: "/sɛzɔ̃/" },
      { word: "nation", ipa: "/nasjɔ̃/" },
      { word: "émotion", ipa: "/emosjɔ̃/" },
      { word: "prénom", ipa: "/pʁenɔ̃/" },
      { word: "savon", ipa: "/savɔ̃/" },
      { word: "onze", ipa: "/ɔ̃z/" },
      { word: "pont", ipa: "/pɔ̃/" },
      { word: "bon garçon", ipa: "/bɔ̃ gaʁsɔ̃/" },
      { word: "maison ronde", ipa: "/mɛzɔ̃ ʁɔ̃d/" },
    ],
    "fr-o-close": [
      { word: "tôt", ipa: "/to/" },
      { word: "eau claire", ipa: "/o klɛʁ/" },
    ],
    "fr-glide-w": [
      { word: "oui encore", ipa: "/wi ɑ̃kɔʁ/" },
      { word: "Louis voit", ipa: "/lwi vwa/" },
    ],
    "fr-r": [
      { word: "rose", ipa: "/ʁoz/" },
      { word: "rire", ipa: "/ʁiʁ/" },
      { word: "partir", ipa: "/paʁtiʁ/" },
      { word: "regard", ipa: "/ʁəgaʁ/" },
      { word: "retour", ipa: "/ʁətuʁ/" },
      { word: "fromage", ipa: "/fʁɔmaʒ/" },
      { word: "travailler", ipa: "/tʁavaje/" },
      { word: "croire", ipa: "/kʁwaʁ/" },
      { word: "prendre", ipa: "/pʁɑ̃dʁ/" },
      { word: "voiture", ipa: "/vwatyʁ/" },
      { word: "courir", ipa: "/kuʁiʁ/" },
      { word: "arrière", ipa: "/aʁjɛʁ/" },
      { word: "écrire", ipa: "/ekʁiʁ/" },
      { word: "heure", ipa: "/œʁ/" },
      { word: "livre", ipa: "/livʁ/" },
      { word: "rue rouge", ipa: "/ʁy ʁuʒ/" },
      { word: "frère très rare", ipa: "/fʁɛʁ tʁɛ ʁaʁ/" },
      { word: "Paris retour", ipa: "/paʁi ʁətuʁ/" },
    ],
    "fr-schwa": [
      { word: "je le prends", ipa: "/ʒə lə pʁɑ̃/" },
      { word: "petite fenêtre", ipa: "/pətit fənɛtʁ/" },
      { word: "ce que je veux", ipa: "/sə kə ʒə vø/" },
      { word: "samedi matin", ipa: "/samdi matɛ̃/" },
    ],
    "fr-final-consonant-silence": [
      { word: "vin blanc", ipa: "/vɛ̃ blɑ̃/" },
      { word: "Un bon vin blanc.", ipa: "/œ̃ bɔ̃ vɛ̃ blɑ̃/" },
      { word: "J'aime le bon vin blanc.", ipa: "/ʒɛm lə bɔ̃ vɛ̃ blɑ̃/" },
      { word: "le prix bas", ipa: "/lə pʁi ba/" },
      { word: "un mot court", ipa: "/œ̃ mo kuʁ/" },
      { word: "trois amis", ipa: "/tʁwɑzami/" },
      { word: "un grand choix", ipa: "/œ̃ gʁɑ̃ ʃwa/" },
    ],
    "fr-liaison": [
      { word: "deux amis", ipa: "/døzami/" },
      { word: "trois enfants", ipa: "/tʁwɑzɑ̃fɑ̃/" },
      { word: "il est", ipa: "/ilɛ/" },
      { word: "elle arrive", ipa: "/ɛlaʁiv/" },
      { word: "nous avons", ipa: "/nuzavɔ̃/" },
      { word: "ils ont", ipa: "/ilzɔ̃/" },
      { word: "mon ami", ipa: "/mɔnami/" },
      { word: "tout à coup", ipa: "/tutaku/" },
      { word: "neuf heures", ipa: "/nœvœʁ/" },
      { word: "petit enfant", ipa: "/pətitɑ̃fɑ̃/" },
      { word: "grand arbre", ipa: "/gʁɑ̃taʁbʁ/" },
      { word: "bon appétit", ipa: "/bɔnapeti/" },
      { word: "vous êtes", ipa: "/vuzɛt/" },
      { word: "chez eux", ipa: "/ʃezø/" },
      { word: "un homme", ipa: "/œ̃nɔm/" },
      { word: "les yeux", ipa: "/lezjø/" },
      { word: "quand il", ipa: "/kɑ̃til/" },
      { word: "premier avril", ipa: "/pʁəmjeʁavʁil/" },
    ],
    "fr-elision": [
      { word: "j'aime encore", ipa: "/ʒɛm ɑ̃kɔʁ/" },
      { word: "l'école ouvre", ipa: "/lekɔluvʁ/" },
      { word: "c'est ici", ipa: "/sɛtisi/" },
      { word: "qu'il arrive", ipa: "/kilaʁiv/" },
      { word: "d'accord avec elle", ipa: "/dakɔʁ avɛkɛl/" },
      { word: "l'homme écoute", ipa: "/lɔmekut/" },
    ],
  },
  "ru-RU": {
    "ru-a": [
      { word: "страна", ipa: "/strɐˈna/" },
      { word: "банк", ipa: "/bank/" },
      { word: "лампа", ipa: "/ˈlampə/" },
      { word: "карта", ipa: "/ˈkartə/" },
      { word: "рамка", ipa: "/ˈramkə/" },
      { word: "аптека", ipa: "/ɐpˈtʲekə/" },
      { word: "собака", ipa: "/sɐˈbakə/" },
      { word: "машина", ipa: "/mɐˈʂinə/" },
      { word: "завтра", ipa: "/ˈzaftrə/" },
      { word: "автор", ipa: "/ˈaftər/" },
      { word: "адрес", ipa: "/ˈadrʲɪs/" },
      { word: "театр", ipa: "/tʲɪˈatr/" },
      { word: "чай", ipa: "/tɕaj/" },
      { word: "Анна", ipa: "/ˈannə/" },
      { word: "папа", ipa: "/ˈpapə/" },
      { word: "сказать", ipa: "/skɐˈzatʲ/" },
      { word: "мама дома", ipa: "/ˈmamə ˈdomə/" },
      { word: "да там", stressText: "да та́м", ipa: "/dɐ ˈtam/" },
    ],
    "ru-o": [
      { word: "стол", ipa: "/stol/" },
      { word: "окно", ipa: "/ɐkˈno/" },
      { word: "море", ipa: "/ˈmorʲe/" },
      { word: "холод", ipa: "/ˈxolət/" },
      { word: "номер", ipa: "/ˈnomʲɪr/" },
      { word: "сон", ipa: "/son/" },
      { word: "урок", ipa: "/ʊˈrok/" },
      { word: "много", ipa: "/ˈmnogə/" },
      { word: "слово", ipa: "/ˈslovə/" },
      { word: "фото", ipa: "/ˈfoto/" },
      { word: "школа", ipa: "/ˈʂkolə/" },
      { word: "поезд", ipa: "/ˈpojɪst/" },
      { word: "плохо", ipa: "/ˈploxə/" },
      { word: "осень", ipa: "/ˈosʲɪnʲ/" },
      { word: "около", ipa: "/ˈokələ/" },
      { word: "новый", ipa: "/ˈnovɨj/" },
      { word: "дом у моря", ipa: "/dom u ˈmorʲə/" },
      { word: "стол около окна", ipa: "/stol ˈokələ ɐkˈna/" },
    ],
    "ru-i": [
      { word: "видеть", ipa: "/ˈvidʲɪtʲ/" },
      { word: "книга", ipa: "/ˈknʲigə/" },
      { word: "идти", ipa: "/ɪtˈtʲi/" },
      { word: "билет", ipa: "/bʲɪˈlʲet/" },
      { word: "зима", ipa: "/zʲɪˈma/" },
      { word: "письмо", ipa: "/pʲɪsʲˈmo/" },
      { word: "минута", ipa: "/mʲɪˈnutə/" },
      { word: "директор", ipa: "/dʲɪˈrʲektər/" },
      { word: "рис", ipa: "/rʲis/" },
      { word: "интернет", ipa: "/ɪntʲɪrˈnʲet/" },
      { word: "линия", ipa: "/ˈlʲinʲɪjə/" },
      { word: "пирог", ipa: "/pʲɪˈrok/" },
      { word: "кино", ipa: "/kʲɪˈno/" },
      { word: "магазин", ipa: "/məgɐˈzʲin/" },
      { word: "учитель", ipa: "/ʊˈtɕitʲɪlʲ/" },
      { word: "сибирь", ipa: "/sʲɪˈbirʲ/" },
      { word: "мир и имя", ipa: "/mir i ˈimʲə/" },
      { word: "тихо пить", ipa: "/ˈtʲixə pʲitʲ/" },
    ],
    "ru-y": [
      { word: "язык", ipa: "/jɪˈzɨk/" },
      { word: "мыло", ipa: "/ˈmɨlə/" },
      { word: "рынок", ipa: "/ˈrɨnək/" },
      { word: "быть", ipa: "/bɨtʲ/" },
      { word: "выпить", ipa: "/ˈvɨpʲɪtʲ/" },
      { word: "новый", ipa: "/ˈnovɨj/" },
      { word: "старый", ipa: "/ˈstarɨj/" },
      { word: "красивый", ipa: "/krɐˈsʲivɨj/" },
      { word: "дым", ipa: "/dɨm/" },
      { word: "мышь", ipa: "/mɨʂ/" },
      { word: "сын", ipa: "/sɨn/" },
      { word: "вы", ipa: "/vɨ/" },
      { word: "сырой", ipa: "/sɨˈroj/" },
      { word: "лыжи", ipa: "/ˈlɨʐɨ/" },
      { word: "крыло", ipa: "/krɨˈlo/" },
      { word: "выбор", ipa: "/ˈvɨbər/" },
      { word: "мы были", ipa: "/mɨ ˈbɨlʲɪ/" },
      { word: "сыр и рыба", ipa: "/sɨr i ˈrɨbə/" },
    ],
    "ru-u": [
      { word: "улица", ipa: "/ˈulʲɪtsə/" },
      { word: "умный", ipa: "/ˈumnɨj/" },
      { word: "учить", ipa: "/ʊˈtɕitʲ/" },
      { word: "журнал", ipa: "/ʐʊrˈnal/" },
      { word: "автобус", ipa: "/ɐfˈtobʊs/" },
      { word: "бумага", ipa: "/bʊˈmagə/" },
      { word: "купить", ipa: "/kʊˈpʲitʲ/" },
      { word: "душ", ipa: "/duʂ/" },
      { word: "кухня", ipa: "/ˈkuxnʲə/" },
      { word: "труд", ipa: "/trut/" },
      { word: "июнь", ipa: "/ɪˈjunʲ/" },
      { word: "музей", ipa: "/mʊˈzʲej/" },
      { word: "сумка", ipa: "/ˈsumkə/" },
      { word: "утка", ipa: "/ˈutkə/" },
      { word: "куст", ipa: "/kust/" },
      { word: "звук", ipa: "/zvuk/" },
      { word: "утро у друга", ipa: "/ˈutrə u ˈdrugə/" },
      { word: "купить суп", ipa: "/kʊˈpʲitʲ sup/" },
    ],
    "ru-hard-soft": [
      { word: "мат мать", ipa: "/mat/ /matʲ/" },
      { word: "лук люк", ipa: "/luk/ /lʲuk/" },
      { word: "нос нёс", ipa: "/nos/ /nʲos/" },
      { word: "угол уголь", ipa: "/ˈugəl/ /ˈugəlʲ/" },
      { word: "рад ряд", ipa: "/rat/ /rʲat/" },
      { word: "брат брать", ipa: "/brat/ /bratʲ/" },
      { word: "мел мель", ipa: "/mʲel/ /mʲelʲ/" },
      { word: "конь кон", ipa: "/konʲ/ /kon/" },
      { word: "стал сталь", ipa: "/stal/ /stalʲ/" },
      { word: "ест есть", ipa: "/jest/ /jesʲtʲ/" },
      { word: "пыл пыль", ipa: "/pɨl/ /pɨlʲ/" },
      { word: "вес весь", ipa: "/vʲes/ /vʲesʲ/" },
      { word: "мол моль", ipa: "/mol/ /molʲ/" },
      { word: "был быль", ipa: "/bɨl/ /bɨlʲ/" },
      { word: "пол поль", ipa: "/pol/ /polʲ/" },
      { word: "углы угли", ipa: "/ʊˈglɨ/ /ʊˈglʲi/" },
      { word: "брат и брать", ipa: "/brat i bratʲ/" },
      { word: "лук и люк", ipa: "/luk i lʲuk/" },
    ],
    "ru-r": [
      { word: "море", ipa: "/ˈmorʲe/" },
      { word: "Россия", ipa: "/rɐˈsʲijə/" },
      { word: "русский", ipa: "/ˈruskʲɪj/" },
      { word: "брат", ipa: "/brat/" },
      { word: "три", ipa: "/trʲi/" },
      { word: "дверь", ipa: "/dvʲerʲ/" },
      { word: "завтра", ipa: "/ˈzaftrə/" },
      { word: "центр", ipa: "/tsentr/" },
      { word: "сестра", ipa: "/sʲɪˈstra/" },
      { word: "метро", ipa: "/mʲɪˈtro/" },
      { word: "мир", ipa: "/mir/" },
      { word: "варенье", ipa: "/vɐˈrʲenʲjə/" },
      { word: "парк", ipa: "/park/" },
      { word: "привет", ipa: "/prʲɪˈvʲet/" },
      { word: "река", ipa: "/rʲɪˈka/" },
      { word: "трава", ipa: "/trɐˈva/" },
      { word: "река рядом", ipa: "/rʲɪˈka ˈrʲadəm/" },
      { word: "три друга", ipa: "/trʲi ˈdrugə/" },
    ],
    "ru-x": [
      { word: "кухня", ipa: "/ˈkuxnʲə/" },
      { word: "сухой", ipa: "/sʊˈxoj/" },
      { word: "плохо", ipa: "/ˈploxə/" },
      { word: "отдых", ipa: "/ˈoddɨx/" },
      { word: "успех", ipa: "/ʊsˈpʲex/" },
      { word: "хочу", ipa: "/xɐˈtɕu/" },
      { word: "характер", ipa: "/xɐˈraktʲɪr/" },
      { word: "химия", ipa: "/ˈxʲimʲɪjə/" },
      { word: "смех", ipa: "/smʲex/" },
      { word: "верх", ipa: "/vʲerx/" },
      { word: "муха", ipa: "/ˈmuxə/" },
      { word: "ухо", ipa: "/ˈuxə/" },
      { word: "орех", ipa: "/ɐˈrʲex/" },
      { word: "храм", ipa: "/xram/" },
      { word: "хвост", ipa: "/xvost/" },
      { word: "хоккей", ipa: "/xɐˈkʲej/" },
      { word: "хорошо тихо", ipa: "/xərɐˈʂo ˈtʲixə/" },
      { word: "хлеб на кухне", ipa: "/xlʲeb nɐ ˈkuxnʲe/" },
    ],
    "ru-sh-zh": [
      { word: "шар", ipa: "/ʂar/" },
      { word: "шапка", ipa: "/ˈʂapkə/" },
      { word: "кошка", ipa: "/ˈkoʂkə/" },
      { word: "журнал", ipa: "/ʐʊrˈnal/" },
      { word: "жёлтый", ipa: "/ˈʐoltɨj/" },
      { word: "ужин", ipa: "/ˈuʐɨn/" },
      { word: "ложка", ipa: "/ˈloʂkə/" },
      { word: "дождь", ipa: "/doʂtʲ/" },
      { word: "гараж", ipa: "/gɐˈraʂ/" },
      { word: "душ", ipa: "/duʂ/" },
      { word: "нож", ipa: "/noʂ/" },
      { word: "широкий", ipa: "/ʂɨˈrokʲɪj/" },
      { word: "живот", ipa: "/ʐɨˈvot/" },
      { word: "шесть", ipa: "/ʂesʲtʲ/" },
      { word: "жалко", ipa: "/ˈʐalkə/" },
      { word: "шоссе", ipa: "/ʂɐˈsɛ/" },
      { word: "шум и жук", stressText: "шум и жук", ipa: "/ˈʂum i ˈʐuk/" },
      { word: "машина в гараже", ipa: "/mɐˈʂinə v gɐˈraʐe/" },
    ],
    "ru-ts-ch-shch": [
      { word: "центр", ipa: "/tsentr/" },
      { word: "цена", ipa: "/tsɨˈna/" },
      { word: "цепь", ipa: "/tsepʲ/" },
      { word: "конец", ipa: "/kɐˈnʲets/" },
      { word: "чашка", ipa: "/ˈtɕaʂkə/" },
      { word: "читать", ipa: "/tɕɪˈtatʲ/" },
      { word: "вечер", ipa: "/ˈvʲetɕɪr/" },
      { word: "ключ", ipa: "/klʲutɕ/" },
      { word: "щука", ipa: "/ˈɕːukə/" },
      { word: "щётка", ipa: "/ˈɕːotkə/" },
      { word: "борщ", ipa: "/borɕː/" },
      { word: "помощь", ipa: "/ˈpoməɕː/" },
      { word: "товарищ", ipa: "/tɐˈvarʲɪɕː/" },
      { word: "часто", ipa: "/ˈtɕastə/" },
      { word: "человек", ipa: "/tɕɪlɐˈvʲek/" },
      { word: "царь", ipa: "/tsarʲ/" },
      { word: "цена и чай", ipa: "/tsɨˈna i tɕaj/" },
      { word: "борщ и щи", stressText: "борщ и щи", ipa: "/ˈborɕː i ˈɕːi/" },
    ],
    "ru-iotated-vowels": [
      { word: "я дома", ipa: "/ja ˈdomə/" },
      { word: "её имя", ipa: "/jɪˈjo ˈimʲə/" },
      { word: "юный юрист", ipa: "/ˈjunɨj jʊˈrʲist/" },
      { word: "ёлка яркая", ipa: "/ˈjolkə ˈjarkəjə/" },
      { word: "моя семья", ipa: "/mɐˈja sʲɪmʲˈja/" },
      { word: "новая юбка", ipa: "/ˈnovəjə ˈjupkə/" },
    ],
    "ru-unstressed-o-a": [
      { word: "она дома", ipa: "/ɐˈna ˈdomə/" },
      { word: "молоко холодное", ipa: "/məlɐˈko ˈxolədnəjə/" },
      { word: "Москва большая", ipa: "/mɐˈskva bɐlʲˈʂajə/" },
      { word: "дорога назад", ipa: "/dɐˈrogə nɐˈzat/" },
      { word: "окно открыто", ipa: "/ɐkˈno ɐtˈkrɨtə/" },
      { word: "собака голодная", ipa: "/sɐˈbakə ˈgolədnəjə/" },
    ],
    "ru-unstressed-e-ya": [
      { word: "сегодня вечером", ipa: "/sʲɪˈvodnʲə ˈvʲetɕɪrəm/" },
      { word: "семья приехала", ipa: "/sʲɪmʲˈja prʲɪˈjexələ/" },
      { word: "ребята рядом", ipa: "/rʲɪˈbʲatə ˈrʲadəm/" },
      { word: "тетрадь лежит", ipa: "/tʲɪˈtratʲ lʲɪˈʐɨt/" },
    ],
    "ru-final-devoicing": [
      { word: "друг пришёл", ipa: "/druk prʲɪˈʂol/" },
      { word: "город спит", ipa: "/ˈgorət spʲit/" },
      { word: "хлеб свежий", ipa: "/xlʲep ˈsvʲeʐɨj/" },
      { word: "снег идёт", ipa: "/snʲeg ɪˈdʲot/" },
      { word: "сад пустой", ipa: "/sat pʊˈstoj/" },
      { word: "нож тупой", ipa: "/noʂ tʊˈpoj/" },
    ],
    "ru-stress-reduction": [
      { word: "молоко дома", ipa: "/məlɐˈko ˈdomə/" },
      { word: "Москва сегодня", ipa: "/mɐˈskva sʲɪˈvodnʲə/" },
      { word: "телефон на столе", ipa: "/tʲɪlʲɪˈfon nɐ stɐˈlʲe/" },
      { word: "машина у дома", ipa: "/mɐˈʂinə u ˈdomə/" },
      { word: "дорога далеко", ipa: "/dɐˈrogə dəlʲɪˈko/" },
      { word: "погода хорошая", ipa: "/pɐˈgodə xɐˈroʂəjə/" },
      { word: "работа сегодня", ipa: "/rɐˈbotə sʲɪˈvodnʲə/" },
      { word: "вокзал открыт", ipa: "/vɐgˈzal ɐtˈkrɨt/" },
      { word: "семья дома", ipa: "/sʲɪmʲˈja ˈdomə/" },
      { word: "магазин закрыт", ipa: "/məgɐˈzʲin zɐˈkrɨt/" },
      { word: "Москва сегодня холодная.", ipa: "/mɐˈskva sʲɪˈvodnʲə ˈxolədnəjə/" },
      { word: "мама дома", ipa: "/ˈmamə ˈdomə/" },
      { word: "Хорошо, спасибо.", ipa: "/xərɐˈʂo spɐˈsʲibə/" },
      { word: "телефон", ipa: "/tʲɪlʲɪˈfon/" },
      { word: "машина", ipa: "/mɐˈʂinə/" },
      { word: "дорога", ipa: "/dɐˈrogə/" },
      { word: "Москва", ipa: "/mɐˈskva/" },
      { word: "пять билетов", ipa: "/pʲætʲ bʲɪˈlʲetəf/" },
      { word: "учитель читает", ipa: "/ʊˈtɕitʲɪlʲ tɕɪˈtajɪt/" },
      { word: "магазин", ipa: "/məgɐˈzʲin/" },
      { word: "вокзал", ipa: "/vɐgˈzal/" },
      { word: "семья", ipa: "/sʲɪmʲˈja/" },
      { word: "погода", ipa: "/pɐˈgodə/" },
      { word: "понедельник", ipa: "/pənʲɪˈdʲelʲnʲɪk/" },
      { word: "интересно", ipa: "/ɪntʲɪˈrʲesnə/" },
      { word: "молоко", ipa: "/məlɐˈko/" },
      { word: "хорошо", ipa: "/xərɐˈʂo/" },
      { word: "сегодня", ipa: "/sʲɪˈvodnʲə/" },
      { word: "работа", ipa: "/rɐˈbotə/" },
    ],
    "ru-clusters": [
      { word: "встреча завтра", ipa: "/ˈfstrʲetɕə ˈzaftrə/" },
      { word: "текст простой", ipa: "/tʲekst prɐˈstoj/" },
      { word: "врач строгий", ipa: "/vratɕ ˈstrogʲɪj/" },
      { word: "класс большой", ipa: "/klaz bɐlʲˈʂoj/" },
      { word: "страна красивая", ipa: "/strɐˈna krɐˈsʲivəjə/" },
      { word: "группа студентов", ipa: "/ˈgrupə stʊˈdʲentəf/" },
      { word: "Текст простой, но группа большая.", ipa: "/tʲekst prɐˈstoj no ˈgrupə bɐlʲˈʂajə/" },
      { word: "Здравствуйте, студент.", ipa: "/ˈzdrastvʊjtʲe stʊˈdʲent/" },
      { word: "хлеб на кухне", ipa: "/xlʲeb nɐ ˈkuxnʲe/" },
      { word: "стол около окна", ipa: "/stol ˈokələ ɐkˈna/" },
      { word: "вторник", ipa: "/ˈftornʲɪk/" },
      { word: "класс", ipa: "/klas/" },
      { word: "дождь", ipa: "/doʂtʲ/" },
      { word: "транспорт", ipa: "/ˈtransport/" },
      { word: "проблема", ipa: "/prɐˈblʲemə/" },
      { word: "страна", ipa: "/strɐˈna/" },
      { word: "праздник", ipa: "/ˈpraznʲɪk/" },
      { word: "снег", ipa: "/snʲek/" },
      { word: "книга", ipa: "/ˈknʲigə/" },
      { word: "врач", ipa: "/vratɕ/" },
      { word: "студент", ipa: "/stʊˈdʲent/" },
      { word: "сколько", ipa: "/ˈskolʲkə/" },
      { word: "здесь", ipa: "/zdʲesʲ/" },
      { word: "группа", ipa: "/ˈgrupə/" },
      { word: "время", ipa: "/ˈvrʲemʲə/" },
      { word: "строить", ipa: "/ˈstroɪtʲ/" },
    ],
  },
};

function keywordKey(keyword: KeywordEntry): string {
  return keyword.word.trim().toLocaleLowerCase();
}

function normalizePracticeText(text: string): string {
  return text
    .trim()
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function practiceTokens(keyword: KeywordEntry): string[] {
  return normalizePracticeText(keyword.word)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !TOKEN_STOP_WORDS.has(token));
}

function tokenCounts(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

function wouldOverusePracticeToken(
  runningCounts: Map<string, number>,
  keyword: KeywordEntry,
): boolean {
  const counts = tokenCounts(practiceTokens(keyword));

  for (const [token, count] of counts) {
    if ((runningCounts.get(token) ?? 0) + count > PRACTICE_TOKEN_REPEAT_LIMIT) {
      return true;
    }
  }

  return false;
}

function addPracticeTokenCounts(
  runningCounts: Map<string, number>,
  keyword: KeywordEntry,
): void {
  for (const [token, count] of tokenCounts(practiceTokens(keyword))) {
    runningCounts.set(token, (runningCounts.get(token) ?? 0) + count);
  }
}

function prioritizeDiverseKeywords(keywords: KeywordEntry[]): KeywordEntry[] {
  const selected: KeywordEntry[] = [];
  const deferred: KeywordEntry[] = [];
  const runningCounts = new Map<string, number>();

  for (const keyword of keywords) {
    if (wouldOverusePracticeToken(runningCounts, keyword)) {
      deferred.push(keyword);
      continue;
    }

    selected.push(keyword);
    addPracticeTokenCounts(runningCounts, keyword);
  }

  if (selected.length >= MIN_DIVERSE_KEYWORD_OPTIONS_PER_UNIT) {
    return selected;
  }

  return [
    ...selected,
    ...deferred.slice(0, MIN_DIVERSE_KEYWORD_OPTIONS_PER_UNIT - selected.length),
  ];
}

function mergeKeywordEntries(
  baseKeywords: KeywordEntry[],
  extraKeywords: KeywordEntry[],
): KeywordEntry[] {
  const seen = new Set<string>();
  const merged: KeywordEntry[] = [];

  for (const keyword of [...baseKeywords, ...extraKeywords]) {
    const key = keywordKey(keyword);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(keyword);
  }

  return prioritizeDiverseKeywords(merged).slice(0, MAX_KEYWORD_OPTIONS_PER_UNIT);
}

export function spanishPhonemeLayerIpa(ipa: string): string {
  return ipa.replace(/β/g, "b").replace(/ð/g, "d").replace(/ɣ/g, "g");
}

function normalizeKeywordDisplayLayer(
  languageId: LanguageId,
  keyword: KeywordEntry,
): KeywordEntry {
  if (languageId !== "es-ES") return keyword;

  const ipa = spanishPhonemeLayerIpa(keyword.ipa);
  return ipa === keyword.ipa ? keyword : { ...keyword, ipa };
}

function splitContrastIpa(ipa: string): [string, string] {
  const parts = ipa.split("~").map((part) => part.trim());
  if (parts.length >= 2) return [parts[0], parts[1]];
  return [ipa, ipa];
}

function deckLanguageId(languageId: LanguageId): DeckLanguageId | null {
  return languageId === "es-ES" || languageId === "fr-FR" || languageId === "ru-RU"
    ? languageId
    : null;
}

function withDeckStressText(
  languageId: DeckLanguageId,
  keyword: KeywordEntry,
): KeywordEntry {
  if (languageId !== "ru-RU" || keyword.stressText) return keyword;
  const stressText = RUSSIAN_DECK_STRESS_TEXT[keyword.word];
  return stressText ? { ...keyword, stressText } : keyword;
}

function deckKeywordsForUnit(
  languageId: LanguageId,
  slug: string,
): KeywordEntry[] {
  const deckId = deckLanguageId(languageId);
  if (!deckId) return [];

  const deck = LANGUAGE_LEARNING_DECKS[deckId];
  const keywords: KeywordEntry[] = [];

  for (const word of deck.diagnosticWords) {
    if (word.targetUnitSlug === slug) {
      keywords.push({
        word: word.text,
        ipa: word.ipa,
        stressText: word.stressText,
      });
    }
  }

  for (const contrast of deck.contrastDeck) {
    if (contrast.targetUnitSlug !== slug) continue;
    const [leftIpa, rightIpa] = splitContrastIpa(contrast.ipa);
    keywords.push(
      withDeckStressText(deckId, { word: contrast.left, ipa: leftIpa }),
    );
    keywords.push(
      withDeckStressText(deckId, { word: contrast.right, ipa: rightIpa }),
    );
  }

  for (const sentence of deck.sentenceDeck) {
    if (sentence.targetUnitSlugs.includes(slug)) {
      keywords.push({
        word: sentence.text,
        ipa: sentence.ipaHint,
        stressText: sentence.stressText,
      });
    }
  }

  return keywords;
}

export function expandLanguageKeywordOptions(
  languageId: LanguageId,
  units: PhonemeData[],
): PhonemeData[] {
  const languageExtras = EXTRA_KEYWORD_OPTIONS[languageId] ?? {};

  return units.map((soundUnit) => {
    const keywords = mergeKeywordEntries(
      soundUnit.keywords,
      [
        ...(languageExtras[soundUnit.slug] ?? []),
        ...deckKeywordsForUnit(languageId, soundUnit.slug),
      ],
    );

    return {
      ...soundUnit,
      keywords: keywords.map((keyword) =>
        normalizeKeywordDisplayLayer(languageId, keyword),
      ),
      notes:
        soundUnit.keywords.length >= MIN_KEYWORD_OPTIONS_PER_UNIT
          ? soundUnit.notes
          : [
              ...(soundUnit.notes ?? []),
              `已扩展到 ${keywords.length} 个可轮换发音选项。`,
            ],
    };
  });
}
