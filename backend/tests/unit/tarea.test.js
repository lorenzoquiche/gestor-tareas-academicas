import { describe, expect, it } from 'vitest';

import {
  validateEstado,
  validateEstadoFilter,
  validateNewTarea,
  validateTareaId,
} from '../../src/validation/tarea.js';

const FECHA_VALIDA = '2026-10-21';

function tareaValida(overrides = {}) {
  return {
    titulo: 'Preparar entrega',
    fechaEntrega: FECHA_VALIDA,
    ...overrides,
  };
}

describe('validateNewTarea', () => {
  describe('cuerpo', () => {
    it.each([
      ['ausente', undefined],
      ['null', null],
      ['array', []],
    ])('rechaza un cuerpo %s', (_caso, body) => {
      expect(validateNewTarea(body)).toEqual({
        error: 'El cuerpo de la solicitud debe ser un objeto JSON.',
      });
    });
  });

  describe('título', () => {
    it('elimina los espacios al inicio y al final', () => {
      expect(
        validateNewTarea(tareaValida({ titulo: '  Preparar entrega  ' })),
      ).toEqual({
        value: {
          titulo: 'Preparar entrega',
          descripcion: '',
          prioridad: 'media',
          fechaEntrega: FECHA_VALIDA,
        },
      });
    });

    it.each([
      ['vacío', ''],
      ['compuesto únicamente por espacios', '   '],
    ])('rechaza un título %s', (_caso, titulo) => {
      expect(validateNewTarea(tareaValida({ titulo }))).toEqual({
        error: 'El título debe tener entre 1 y 120 caracteres.',
      });
    });

    it('acepta exactamente 120 caracteres', () => {
      const titulo = 'a'.repeat(120);

      expect(validateNewTarea(tareaValida({ titulo }))).toEqual({
        value: {
          titulo,
          descripcion: '',
          prioridad: 'media',
          fechaEntrega: FECHA_VALIDA,
        },
      });
    });

    it('rechaza 121 caracteres', () => {
      expect(
        validateNewTarea(tareaValida({ titulo: 'a'.repeat(121) })),
      ).toEqual({
        error: 'El título debe tener entre 1 y 120 caracteres.',
      });
    });

    it.each([
      ['número', 42],
      ['objeto', { texto: 'Preparar entrega' }],
      ['array', ['Preparar entrega']],
    ])('rechaza un título de tipo %s', (_caso, titulo) => {
      expect(validateNewTarea(tareaValida({ titulo }))).toEqual({
        error: 'El título es obligatorio y debe ser texto.',
      });
    });
  });

  describe('descripción', () => {
    it('usa una cadena vacía cuando está ausente', () => {
      expect(validateNewTarea(tareaValida())).toEqual({
        value: {
          titulo: 'Preparar entrega',
          descripcion: '',
          prioridad: 'media',
          fechaEntrega: FECHA_VALIDA,
        },
      });
    });

    it('acepta exactamente 1000 caracteres', () => {
      const descripcion = 'a'.repeat(1000);

      expect(validateNewTarea(tareaValida({ descripcion }))).toEqual({
        value: {
          titulo: 'Preparar entrega',
          descripcion,
          prioridad: 'media',
          fechaEntrega: FECHA_VALIDA,
        },
      });
    });

    it('rechaza 1001 caracteres', () => {
      expect(
        validateNewTarea(tareaValida({ descripcion: 'a'.repeat(1001) })),
      ).toEqual({
        error: 'La descripción no puede superar los 1000 caracteres.',
      });
    });

    it.each([
      ['número', 10],
      ['objeto', { texto: 'Detalle' }],
      ['array', ['Detalle']],
    ])('rechaza una descripción de tipo %s', (_caso, descripcion) => {
      expect(validateNewTarea(tareaValida({ descripcion }))).toEqual({
        error: 'La descripción debe ser texto.',
      });
    });
  });

  describe('prioridad', () => {
    it.each(['baja', 'media', 'alta'])(
      'acepta la prioridad %s',
      (prioridad) => {
        expect(validateNewTarea(tareaValida({ prioridad }))).toEqual({
          value: {
            titulo: 'Preparar entrega',
            descripcion: '',
            prioridad,
            fechaEntrega: FECHA_VALIDA,
          },
        });
      },
    );

    it('usa prioridad media cuando está ausente', () => {
      expect(validateNewTarea(tareaValida()).value.prioridad).toBe('media');
    });

    it.each([
      [
        'valor no permitido',
        'urgente',
        'La prioridad debe ser baja, media o alta.',
      ],
      ['tipo incorrecto', 1, 'La prioridad debe ser texto.'],
    ])('rechaza prioridad con %s', (_caso, prioridad, error) => {
      expect(validateNewTarea(tareaValida({ prioridad }))).toEqual({ error });
    });
  });

  describe('fecha de entrega', () => {
    it.each([
      ['fecha válida', '2026-12-15'],
      ['fecha pasada', '2000-01-01'],
    ])('acepta una %s', (_caso, fechaEntrega) => {
      expect(validateNewTarea(tareaValida({ fechaEntrega }))).toEqual({
        value: {
          titulo: 'Preparar entrega',
          descripcion: '',
          prioridad: 'media',
          fechaEntrega,
        },
      });
    });

    it.each(['21-10-2026', '2026-1-01', '2026/01/01'])(
      'rechaza el formato incorrecto %s',
      (fechaEntrega) => {
        expect(validateNewTarea(tareaValida({ fechaEntrega }))).toEqual({
          error:
            'La fecha de entrega es obligatoria y debe ser una fecha real con formato YYYY-MM-DD.',
        });
      },
    );

    it.each(['2026-02-30', '2026-04-31'])(
      'rechaza la fecha inexistente %s',
      (fechaEntrega) => {
        expect(validateNewTarea(tareaValida({ fechaEntrega }))).toEqual({
          error:
            'La fecha de entrega es obligatoria y debe ser una fecha real con formato YYYY-MM-DD.',
        });
      },
    );

    it('acepta el 29 de febrero de un año bisiesto', () => {
      expect(
        validateNewTarea(tareaValida({ fechaEntrega: '2024-02-29' })),
      ).toEqual({
        value: {
          titulo: 'Preparar entrega',
          descripcion: '',
          prioridad: 'media',
          fechaEntrega: '2024-02-29',
        },
      });
    });

    it('rechaza el 29 de febrero de un año no bisiesto', () => {
      expect(
        validateNewTarea(tareaValida({ fechaEntrega: '2023-02-29' })),
      ).toEqual({
        error:
          'La fecha de entrega es obligatoria y debe ser una fecha real con formato YYYY-MM-DD.',
      });
    });
  });
});

describe('validateTareaId', () => {
  it('acepta un entero positivo seguro representado como texto', () => {
    expect(validateTareaId('42')).toEqual({ value: 42 });
  });

  it.each([
    [
      'texto mezclado',
      '12a',
      'El id debe contener únicamente dígitos.',
    ],
    ['decimal', '1.5', 'El id debe contener únicamente dígitos.'],
    [
      'cero',
      '0',
      'El id debe representar un entero positivo seguro.',
    ],
    ['negativo', '-1', 'El id debe contener únicamente dígitos.'],
    [
      'superior a Number.MAX_SAFE_INTEGER',
      String(Number.MAX_SAFE_INTEGER + 1),
      'El id debe representar un entero positivo seguro.',
    ],
  ])('rechaza un id %s', (_caso, value, error) => {
    expect(validateTareaId(value)).toEqual({ error });
  });
});

describe('validateEstado', () => {
  it.each(['pendiente', 'completada'])('acepta el estado %s', (estado) => {
    expect(validateEstado({ estado })).toEqual({ value: estado });
  });

  it.each([
    ['inválido', 'cancelada'],
    ['de tipo incorrecto', 1],
  ])('rechaza un estado %s', (_caso, estado) => {
    expect(validateEstado({ estado })).toEqual({
      error: 'El estado debe ser pendiente o completada.',
    });
  });

  it.each([
    ['ausente', undefined],
    ['null', null],
    ['array', []],
  ])('rechaza un cuerpo %s', (_caso, body) => {
    expect(validateEstado(body)).toEqual({
      error: 'El cuerpo de la solicitud debe ser un objeto JSON.',
    });
  });
});

describe('validateEstadoFilter', () => {
  it('acepta que el filtro esté ausente', () => {
    expect(validateEstadoFilter({})).toEqual({ value: undefined });
  });

  it.each(['pendiente', 'completada'])(
    'acepta el filtro %s',
    (estado) => {
      expect(validateEstadoFilter({ estado })).toEqual({ value: estado });
    },
  );

  it.each([
    ['vacío', ''],
    ['repetido', ['pendiente', 'completada']],
    ['con valor inválido', 'cancelada'],
  ])('rechaza un filtro %s', (_caso, estado) => {
    expect(validateEstadoFilter({ estado })).toEqual({
      error:
        'El filtro estado debe ser pendiente o completada y aparecer una sola vez.',
    });
  });
});
