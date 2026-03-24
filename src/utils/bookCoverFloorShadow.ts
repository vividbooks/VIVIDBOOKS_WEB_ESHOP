/**
 * Sdílený „stín pod obálkou“ (katalog, PDP, hero vějíř).
 * Používáme SVG s průhledností — PNG bez alfa kanálu (plné černé pozadí) vypadá jako černý obdélník.
 * Chcete vlastní PNG? Exportujte jen měkký stín na průhledném pozadí a přepněte příponu níže.
 */
export const BOOK_COVER_FLOOR_SHADOW_SRC = `${import.meta.env.BASE_URL}images/book-cover-floor-shadow.svg`;
