import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import FiltroCategorias from './FiltroCategorias';

function Prueba() {
  const [valor, setValor] = useState([]);
  return <><FiltroCategorias opciones={['SUB-13', 'SUB-15', 'SUB-17']} valor={valor} onCambiar={setValor} /><output>{valor.join('|')}</output></>;
}

describe('FiltroCategorias', () => {
  it('elige varias, muestra el resumen y "Todas" limpia', () => {
    render(<Prueba />);
    expect(screen.getByText('Todas las categorías')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('SUB-13'));
    fireEvent.click(screen.getByLabelText('SUB-17'));
    expect(document.querySelector('output').textContent).toBe('SUB-13|SUB-17');
    expect(screen.getByText('SUB-13, SUB-17')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('SUB-13'));
    expect(document.querySelector('output').textContent).toBe('SUB-17');
    fireEvent.click(screen.getByLabelText('Todas'));
    expect(document.querySelector('output').textContent).toBe('');
  });
});
