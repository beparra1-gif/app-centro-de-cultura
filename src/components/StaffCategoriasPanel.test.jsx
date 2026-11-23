import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import * as api from '../api/client';
import StaffCategoriasPanel from './StaffCategoriasPanel';
import { enAlcanceStaff } from '../utils/categoriasStaff';

const cuentas = [
  { id: 1, nombres: 'Ana', apellido_paterno: 'Soto', rol: 'staff', categorias_asignadas: ['SUB-13'] },
  { id: 2, nombres: 'Beto', apellido_paterno: 'Paz', rol: 'staff', categorias_asignadas: ['MASCULINA|SUB-13'] },
  { id: 3, nombres: 'Caro', apellido_paterno: 'Ruiz', rol: 'staff', categorias_asignadas: [] },
  { id: 4, nombres: 'Dani', apellido_paterno: 'Mora', rol: 'apoderado' },
];
const jugadores = [
  { categoria: 'SUB-13', rama: 'MASCULINA' }, { categoria: 'SUB-13', rama: 'FEMENINA' },
  { categoria: 'SUB-15', rama: 'FEMENINA' }, { categoria: 'SUB-17', rama: 'FEMENINA' },
];

describe('StaffCategoriasPanel', () => {
  it('asigna 1 categoría de hombres y 3 de mujeres en la ventana', async () => {
    const update = vi.spyOn(api.cuentasAPI, 'update').mockResolvedValue({});
    render(<StaffCategoriasPanel cuentas={cuentas} jugadores={jugadores} onRecargar={vi.fn()} />);
    expect(screen.queryByText('Dani Mora')).toBeNull();
    expect(screen.getByText('Masculina: SUB-13')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Caro Ruiz/ }));
    const v = screen.getByRole('dialog', { name: 'Caro Ruiz' });
    fireEvent.click(within(v).getByLabelText('SUB-13 Masculina'));
    ['SUB-13', 'SUB-15', 'SUB-17'].forEach((c) => fireEvent.click(within(v).getByLabelText(`${c} Femenina`)));
    expect(within(v).getByText('Femenina: SUB-13, SUB-15, SUB-17 · Masculina: SUB-13', { exact: false })).toBeInTheDocument();
    fireEvent.click(within(v).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(3, {
      categorias_asignadas: ['MASCULINA|SUB-13', 'FEMENINA|SUB-13', 'FEMENINA|SUB-15', 'FEMENINA|SUB-17'],
      ramas_asignadas: [],
      nivel_entrenador: '',
    }));
    update.mockRestore();
  });

  it('una asignación antigua (solo categoría) aparece marcada en ambas ramas', () => {
    render(<StaffCategoriasPanel cuentas={cuentas} jugadores={jugadores} onRecargar={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Ana Soto/ }));
    const v = screen.getByRole('dialog', { name: 'Ana Soto' });
    expect(within(v).getByLabelText('SUB-13 Masculina')).toBeChecked();
    expect(within(v).getByLabelText('SUB-13 Femenina')).toBeChecked();
    expect(within(v).getByLabelText('SUB-15 Femenina')).not.toBeChecked();
  });
});

describe('enAlcanceStaff', () => {
  it('pares rama|categoría sin distinguir mayúsculas', () => {
    const c = { categorias_asignadas: ['MASCULINA|SUB-13', 'FEMENINA|SUB-15'] };
    expect(enAlcanceStaff(c, { rama: 'masculina', categoria: 'sub-13' })).toBe(true);
    expect(enAlcanceStaff(c, { rama: 'FEMENINA', categoria: 'SUB-13' })).toBe(false);
    expect(enAlcanceStaff({}, { rama: 'FEMENINA', categoria: 'SUB-13' })).toBe(true);
  });
});
