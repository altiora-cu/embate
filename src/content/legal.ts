/**
 * Textos legales (§13 del paquete de dirección: faltaban y hay que resolverlos
 * antes de abrir el registro público).
 *
 * IMPORTANTE: son borradores de trabajo redactados a partir de lo que la app
 * efectivamente hace. NO son asesoramiento legal ni sustituyen la revisión de un
 * abogado antes de abrir el registro al público. Están acá, en código y no en un
 * CMS, porque tienen que versionarse junto con los cambios del producto que
 * describen.
 */

export const LEGAL_LAST_UPDATED = "2026-07-29";

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export interface LegalDocument {
  title: string;
  intro: string;
  sections: LegalSection[];
}

const TERMS_ES: LegalDocument = {
  title: "Términos de servicio",
  intro:
    "Estos términos regulan el uso de Embate, una plataforma para organizar y administrar torneos competitivos de videojuegos. Al crear una cuenta aceptas lo que sigue.",
  sections: [
    {
      heading: "1. Qué es Embate",
      paragraphs: [
        "Embate es una herramienta de gestión que permite a organizadores crear comunidades y torneos, generar cruces, registrar resultados y llevar estadísticas de jugadores.",
        "Embate no organiza torneos propios ni participa en la relación entre un organizador y sus jugadores. Cada organizador es responsable de las reglas, premios y conducta de su comunidad.",
      ],
    },
    {
      heading: "2. Cuentas",
      paragraphs: [
        "Necesitas una cuenta para usar la plataforma. Una cuenta es personal e intransferible, y eres responsable de la actividad que ocurra bajo ella.",
        "Puedes pertenecer a varias comunidades con la misma cuenta. Tus estadísticas se calculan por separado en cada comunidad.",
        "Puedes eliminar tu cuenta en cualquier momento escribiendo a la dirección de contacto. Al hacerlo se borran tus datos personales; los resultados de partidos ya disputados pueden conservarse de forma anonimizada para no romper el historial de los torneos de otros jugadores.",
      ],
    },
    {
      heading: "3. Resultados y disputas",
      paragraphs: [
        "Los resultados los cargan los propios jugadores y requieren la confirmación de ambos. Cuando los reportes no coinciden, el partido queda en disputa y lo resuelve la administración de esa comunidad.",
        "Las decisiones sobre disputas las toma el organizador, no Embate. Embate provee la herramienta y el registro; no arbitra partidos.",
        "Subir capturas alteradas, reportar resultados falsos o abusar del sistema de disputas puede derivar en la expulsión de la comunidad por parte del organizador, y en la suspensión de la cuenta.",
      ],
    },
    {
      heading: "4. Contenido que subís",
      paragraphs: [
        "Al subir una captura de pantalla confirmas que tienes derecho a hacerlo y nos autorizas a almacenarla y mostrarla a los demás miembros de esa comunidad con el fin de validar el resultado.",
        "No subas contenido ilegal, ofensivo ni ajeno al propósito de registrar un marcador.",
      ],
    },
    {
      heading: "5. Pagos y premios",
      paragraphs: [
        "Embate no recibe, custodia ni distribuye dinero de premios ni de inscripciones. Si un organizador cobra una inscripción, lo hace con sus propios medios y bajo su responsabilidad.",
        "Embate no es una plataforma de juego con dinero real ni de apuestas, y no debe usarse como tal.",
      ],
    },
    {
      heading: "6. Marcas de terceros",
      paragraphs: [
        "Embate no está afiliado, patrocinado ni respaldado por Electronic Arts Inc. ni sus licenciantes. Toda marca mencionada pertenece a sus respectivos titulares y se nombra únicamente a título descriptivo.",
      ],
    },
    {
      heading: "7. Disponibilidad y responsabilidad",
      paragraphs: [
        "El servicio se ofrece tal cual está. Hacemos lo razonable para mantenerlo disponible, pero no garantizamos que funcione sin interrupciones ni errores.",
        "En la medida que la ley lo permita, Embate no responde por daños indirectos derivados del uso del servicio, incluida la pérdida de datos de un torneo.",
      ],
    },
    {
      heading: "8. Cambios",
      paragraphs: [
        "Podemos actualizar estos términos. Si el cambio es sustancial, lo avisaremos dentro de la aplicación con antelación razonable.",
      ],
    },
  ],
};

const TERMS_EN: LegalDocument = {
  title: "Terms of service",
  intro:
    "These terms govern the use of Embate, a platform for organizing and running competitive video game tournaments. By creating an account you accept what follows.",
  sections: [
    {
      heading: "1. What Embate is",
      paragraphs: [
        "Embate is a management tool that lets organizers create communities and tournaments, draw matchups, record results and track player statistics.",
        "Embate does not run its own tournaments and is not part of the relationship between an organizer and their players. Each organizer is responsible for the rules, prizes and conduct of their community.",
      ],
    },
    {
      heading: "2. Accounts",
      paragraphs: [
        "You need an account to use the platform. An account is personal and non-transferable, and you are responsible for activity under it.",
        "You can belong to several communities with the same account. Your statistics are calculated separately within each community.",
        "You can delete your account at any time by writing to the contact address. Doing so removes your personal data; results of matches already played may be retained in anonymized form so other players' tournament history stays intact.",
      ],
    },
    {
      heading: "3. Results and disputes",
      paragraphs: [
        "Results are reported by the players themselves and require both to agree. When reports don't match, the match goes into dispute and the administration of that community resolves it.",
        "Dispute decisions are made by the organizer, not by Embate. Embate provides the tool and the record; it does not referee matches.",
        "Uploading altered screenshots, reporting false results or abusing the dispute system may lead to removal from the community by the organizer, and to account suspension.",
      ],
    },
    {
      heading: "4. Content you upload",
      paragraphs: [
        "By uploading a screenshot you confirm you have the right to do so and authorize us to store it and show it to other members of that community for the purpose of validating the result.",
        "Do not upload illegal or offensive content, or anything unrelated to recording a score.",
      ],
    },
    {
      heading: "5. Payments and prizes",
      paragraphs: [
        "Embate does not receive, hold or distribute prize or entry money. If an organizer charges an entry fee, they do so by their own means and under their own responsibility.",
        "Embate is not a real-money gaming platform and must not be used as one.",
      ],
    },
    {
      heading: "6. Third-party trademarks",
      paragraphs: [
        "Embate is not affiliated with, sponsored by, or endorsed by Electronic Arts Inc. or its licensors. Any trademark mentioned belongs to its respective owner and is named for descriptive purposes only.",
      ],
    },
    {
      heading: "7. Availability and liability",
      paragraphs: [
        "The service is provided as is. We make reasonable efforts to keep it available, but we do not guarantee uninterrupted or error-free operation.",
        "To the extent permitted by law, Embate is not liable for indirect damages arising from use of the service, including loss of tournament data.",
      ],
    },
    {
      heading: "8. Changes",
      paragraphs: [
        "We may update these terms. If a change is substantial, we will announce it inside the application with reasonable notice.",
      ],
    },
  ],
};

const PRIVACY_ES: LegalDocument = {
  title: "Política de privacidad",
  intro:
    "Esta política explica qué datos recoge Embate, para qué los usa y qué control tienes sobre ellos.",
  sections: [
    {
      heading: "1. Qué datos recogemos",
      paragraphs: [
        "De tu cuenta: dirección de correo electrónico y nombre visible.",
        "De tu participación: el gamertag y la plataforma que declarás al inscribirte en un torneo, los resultados de tus partidos y las capturas de pantalla que subís.",
        "Derivados: estadísticas por comunidad (partidos ganados, empatados y perdidos, goles, puntualidad y comportamiento en disputas) y la calificación que se calcula a partir de ellas.",
      ],
    },
    {
      heading: "2. Para qué los usamos",
      paragraphs: [
        "Para que puedas entrar a tu cuenta, participar en torneos y ver tu historial.",
        "Para que los demás miembros de tu comunidad puedan validar resultados y ver la tabla y el ranking.",
        "Para enviarte avisos operativos del servicio, como un resultado pendiente de confirmar o un cruce nuevo disponible. No usamos tu correo para publicidad de terceros.",
      ],
    },
    {
      heading: "3. Quién puede ver tus datos",
      paragraphs: [
        "Tus estadísticas, tu gamertag y tus capturas son visibles para los miembros de la comunidad en la que jugás, y para la administración de esa comunidad.",
        "Las comunidades están aisladas entre sí: los miembros de una comunidad no pueden ver tus datos de otra.",
        "No vendemos tus datos ni los cedemos a terceros con fines comerciales.",
      ],
    },
    {
      heading: "4. Página pública de la comunidad",
      paragraphs: [
        "Un organizador puede activar una página pública de su comunidad. Si lo hace, cualquier persona con el enlace —sin cuenta— puede ver los torneos, los gamertags de quienes participan y los resultados de los partidos.",
        "Esa página NO expone perfiles, correos electrónicos, capturas de pantalla, disputas ni estadísticas de jugador. Viene desactivada por defecto y solo el organizador puede encenderla.",
        "Si no quieres que tu gamertag aparezca en una página pública, pregúntale al organizador de tu comunidad si la tiene activada antes de anotarte a un torneo.",
      ],
    },
    {
      heading: "5. Dónde se guardan",
      paragraphs: [
        "Los datos se almacenan en la infraestructura de Supabase, que actúa como proveedor de base de datos y almacenamiento. Las capturas se guardan en un espacio privado, separado por comunidad, y se acceden mediante enlaces temporales.",
      ],
    },
    {
      heading: "6. Cuánto tiempo",
      paragraphs: [
        "Mientras tengas la cuenta activa. Si la eliminás, se borran tus datos personales. Los resultados de partidos ya jugados pueden conservarse anonimizados para no alterar el historial de los torneos en los que participaron otras personas.",
      ],
    },
    {
      heading: "7. Tus derechos",
      paragraphs: [
        "Puedes acceder a tus datos, corregirlos o pedir su eliminación escribiendo a la dirección de contacto.",
        "También puedes salir de una comunidad en cualquier momento; eso deja de mostrar tu perfil a esa comunidad.",
      ],
    },
    {
      heading: "8. Menores",
      paragraphs: [
        "El servicio no está dirigido a menores de la edad mínima que exija la legislación aplicable en su país para consentir el tratamiento de datos. Si detectamos una cuenta en esa situación, la eliminaremos.",
      ],
    },
  ],
};

const PRIVACY_EN: LegalDocument = {
  title: "Privacy policy",
  intro:
    "This policy explains what data Embate collects, what it uses it for, and what control you have over it.",
  sections: [
    {
      heading: "1. What we collect",
      paragraphs: [
        "From your account: email address and display name.",
        "From your participation: the gamertag and platform you declare when registering for a tournament, your match results and the screenshots you upload.",
        "Derived: per-community statistics (wins, draws and losses, goals, punctuality and dispute behavior) and the rating calculated from them.",
      ],
    },
    {
      heading: "2. What we use it for",
      paragraphs: [
        "So you can sign in, take part in tournaments and see your history.",
        "So other members of your community can validate results and see the table and ranking.",
        "To send you operational notices about the service, such as a result pending confirmation or a new matchup available. We do not use your email for third-party advertising.",
      ],
    },
    {
      heading: "3. Who can see your data",
      paragraphs: [
        "Your statistics, gamertag and screenshots are visible to members of the community you play in, and to that community's administration.",
        "Communities are isolated from each other: members of one community cannot see your data from another.",
        "We do not sell your data or share it with third parties for commercial purposes.",
      ],
    },
    {
      heading: "4. Community public page",
      paragraphs: [
        "An organizer can turn on a public page for their community. If they do, anyone with the link — with no account — can see the tournaments, the gamertags of the people taking part, and the match results.",
        "That page does NOT expose profiles, email addresses, screenshots, disputes or player statistics. It is off by default and only the organizer can turn it on.",
        "If you don't want your gamertag on a public page, ask your community organizer whether it is on before signing up for a tournament.",
      ],
    },
    {
      heading: "5. Where it is stored",
      paragraphs: [
        "Data is stored on Supabase infrastructure, acting as database and storage provider. Screenshots are kept in a private space, separated by community, and accessed through temporary links.",
      ],
    },
    {
      heading: "6. How long",
      paragraphs: [
        "For as long as your account is active. If you delete it, your personal data is removed. Results of matches already played may be retained in anonymized form so the history of tournaments involving other people is not altered.",
      ],
    },
    {
      heading: "7. Your rights",
      paragraphs: [
        "You can access your data, correct it or request its deletion by writing to the contact address.",
        "You can also leave a community at any time; that stops showing your profile to that community.",
      ],
    },
    {
      heading: "8. Minors",
      paragraphs: [
        "The service is not directed at anyone below the minimum age required by applicable law in their country to consent to data processing. If we detect such an account, we will delete it.",
      ],
    },
  ],
};

export const LEGAL_DOCUMENTS = {
  terms: { es: TERMS_ES, en: TERMS_EN },
  privacy: { es: PRIVACY_ES, en: PRIVACY_EN },
} as const;

export type LegalDocumentId = keyof typeof LEGAL_DOCUMENTS;
