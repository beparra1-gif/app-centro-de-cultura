import { describe, it, expect } from 'vitest';
import { ordenarPersonas } from './ordenarPersonas';

const lista = [
  { nombre: 'Ana', apellido: 'Zúñiga', fechaNacimiento: '2012-05-01', categoria: 'SUB-13', deuda: 30000 },
  { nombre: 'Beto', apellido: 'Álvarez', fechaNacimiento: '2015-01-10', categoria: 'SUB-11', deuda: 0 },
  { nombre: 'Carla', apellido: 'Muñoz', fechaNacimiento: '', categoria: 'SIN CATEGORÍA', deuda: 60000 },
  { nombre: 'Diego', apellido: 'Bravo', fechaNacimiento: '2009-09-09', categoria: 'SUB-17 / SUB-18', deuda: 15000 },
];
const nombres = (l) => l.map((p) => p.nombre);

describe('ordenarPersonas', () => {
  it('apellido A→Z ignora tildes', () => {
    expect(nombres(ordenarPersonas(lista, { orden: 'apellido', dir: 'asc' }))).toEqual(['Beto', 'Diego', 'Carla', 'Ana']);
  });
  it('apellido Z→A', () => {
    expect(nombres(ordenarPersonas(lista, { orden: 'apellido', dir: 'desc' }))).toEqual(['Ana', 'Carla', 'Diego', 'Beto']);
  });
  it('edad: menor primero y sin fecha al final', () => {
    expect(nombres(ordenarPersonas(lista, { orden: 'edad', dir: 'asc' }))).toEqual(['Beto', 'Ana', 'Diego', 'Carla']);
    expect(nombres(ordenarPersonas(lista, { orden: 'edad', dir: 'desc' }))).toEqual(['Diego', 'Ana', 'Beto', 'Carla']);
  });
  it('fecha de nacimiento: más antigua primero', () => {
    expect(nombres(ordenarPersonas(lista, { orden: 'nacimiento', dir: 'asc' }))).toEqual(['Diego', 'Ana', 'Beto', 'Carla']);
  });
  it('categoría numérica y sin categoría al final', () => {
    expect(nombres(ordenarPersonas(lista, { orden: 'categoria', dir: 'asc' }))).toEqual(['Beto', 'Ana', 'Diego', 'Carla']);
    expect(nombres(ordenarPersonas(lista, { orden: 'categoria', dir: 'desc' }))).toEqual(['Diego', 'Ana', 'Beto', 'Carla']);
  });
  it('deuda: mayor primero', () => {
    expect(nombres(ordenarPersonas(lista, { orden: 'deuda', dir: 'desc' }))).toEqual(['Carla', 'Ana', 'Diego', 'Beto']);
  });
  it('no modifica la lista original', () => {
    const copia = [...lista];
    ordenarPersonas(lista, { orden: 'nombre', dir: 'desc' });
    expect(lista).toEqual(copia);
  });
});
