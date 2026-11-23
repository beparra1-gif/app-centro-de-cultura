import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import * as api from '../api/client';
import StaffCategoriasPanel from './StaffCategoriasPanel';

const cuentas = [
  { id: 1, nombres: 'Ana', apellido_paterno: 'Soto', rol: 'staff', categorias_asignadas: ['SUB-13', 'SUB-15'] },
  { id: 2, nombres: 'Beto', apellido_paterno: 'Paz', rol: 'staff', categorias_asignadas: ['SUB-13'] },
  { id: 3, nombres: 'Caro', apellido_paterno: 'Ruiz', rol: 'staff', categorias_asignadas: [] },
  { id: 4, nombres: 'Dani', apellido_paterno: 'Mora', rol: 'apoderado' },
];
const jugadores = [{ categoria: 'SUB-13' }, { categoria: 'sub-15' }, { categoria: 'SUB-17' }];

describe('StaffCategoriasPanel', () => {
  it('muestra varios entrenadores por categoría, agrega y quita', async () => {
    const update = vi.spyOn(api.cuentasAPI, 'update').mockResolvedValue({});
    const onRecargar = vi.fn();
    render(<StaffCategoriasPanel cuentas={cuentas} jugadores={jugadores} onRecargar={onRecargar} />);

    expect(screen.getByText(/Ven todas las categorías/).parentElement.textContent).toContain('Caro Ruiz');
    expect(screen.getByRole('button', { name: 'Quitar a Ana Soto de SUB-13' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar a Beto Paz de SUB-13' })).toBeInTheDocument();
    expect(screen.queryByText('Dani Mora')).toBeNull();

    fireEvent.change(screen.getByLabelText('Agregar entrenador a SUB-17'), { target: { value: '2' } });
    await waitFor(() => expect(update).toHaveBeenCalledWith(2, { categorias_asignadas: ['SUB-13', 'SUB-17'] }));

    fireEvent.click(screen.getByRole('button', { name: /Quitar a Ana Soto de SUB-15/i }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(1, { categorias_asignadas: ['SUB-13'] }));
    expect(onRecargar).toHaveBeenCalled();
    update.mockRestore();
  });
});
