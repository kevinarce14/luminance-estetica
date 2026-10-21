import { HttpStatus, ParseIntPipe } from '@nestjs/common';

/** IDs de ruta numéricos. 422 ante un valor inválido, igual que FastAPI y el ValidationPipe global. */
export const ParseIdPipe = new ParseIntPipe({
  errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
});
