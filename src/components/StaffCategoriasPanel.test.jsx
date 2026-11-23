import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import * as api from '../api/client';
import StaffCategoriasPanel from './StaffCategoriasPanel';

const cuentas = [
  { id: 1, nombres: 'Ana', apellido_paterno: 'Soto', rol: 'staff', categorias_asignadas: ['SUB-13', 'SUB-15'], ramas_asignadas: [] },
  { id: 2, nombres: 'Beto', apellido_paterno: 'Paz', rol: 'staff', categorias_asignadas: ['SUB-13'], ramas_asignadas: ['MASCULINA'] },
  { id: 3, nombres: 'Caro', apellido_paterno: 'Ruiz', rol: 'staff', categorias_asignadas: [] },
  { id: 4, nombres: 'Dani', apellido_paterno: 'Mora', rol: 'apoderado' },
];
const jugadores = [
  { categoria: 'SUB-13', rama: 'MASCULINA' }, { categoria: 'SUB-15', rama: 'FEMENINA' }, { categoria: 'SUB-17', rama: 'FEMENINA' },
];

describe('StaffCategoriasPanel', () => {
  it('al elegir un entrenador abre la ventana con rama y categorías, y guarda', async () => {
    const update = vi.spyOn(api.cuentasAPI, 'update').mockResolvedValue({});
    render(<StaffCategoriasPanel cuentas={cuentas} jugadores={jugadores} onRecargar={vi.fn()} />);

    expect(screen.queryByText('Dani Mora')).toBeNull();
    expect(screen.getByText('Masculina · SUB-13')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Ana Soto/ }));
    const ventana = screen.getByRole('dialog', { name: 'Ana Soto' });
    expect(within(ventana).getByText(/Hoy: Todas las ramas · SUB-13, SUB-15/)).toBeInTheDocument();
    fireEvent.click(within(ventana).getByLabelText('Femenina'));
    fireEvent.click(within(ventana).getByLabelText('SUB-17'));
    expect(within(ventana).getByText(/Femenina · SUB-13, SUB-15, SUB-17/)).toBeInTheDocument();
    fireEvent.click(within(ventana).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(1, { ramas_asignadas: ['FEMENINA'], categorias_asignadas: ['SUB-13', 'SUB-15', 'SUB-17'] }));
    update.mockRestore();
  });

  it('por categoría: varios entrenadores y agregar uno', async () => {
    const update = vi.spyOn(api.cuentasAPI, 'update').mockResolvedValue({});
    render(<StaffCategoriasPanel cuentas={cuentas} jugadores={jugadores} onRecargar={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Por categoría' }));
    fireEvent.change(screen.getByLabelText('Agregar entrenador a SUB-17'), { target: { value: '2' } });
    await waitFor(() => expect(update).toHaveBeenCalledWith(2, { ramas_asignadas: ['MASCULINA'], categorias_asignadas: ['SUB-13', 'SUB-17'] }));
    update.mockRestore();
  });
});
