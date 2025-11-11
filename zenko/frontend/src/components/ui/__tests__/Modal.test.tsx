import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import Modal from '../Modal';

describe('Modal accessibility', () => {
  it('focuses the first interactive element when opened', async () => {
    render(
      <>
        <button type="button">Outside</button>
        <Modal open title="Exemplo" onClose={() => {}}>
          <input placeholder="Nome" />
          <button type="button">Salvar</button>
        </Modal>
      </>
    );

    const closeButton = screen.getByRole('button', { name: /fechar/i });

    await waitFor(() => expect(closeButton).toHaveFocus());
  });

  it('keeps focus trapped within the modal when tabbing', async () => {
    render(
      <Modal open title="Exemplo" onClose={() => {}}>
        <input placeholder="Nome" />
        <button type="button">Salvar</button>
      </Modal>
    );

    const closeButton = screen.getByRole('button', { name: /fechar/i });
    const saveButton = screen.getByRole('button', { name: /salvar/i });

    await waitFor(() => expect(closeButton).toHaveFocus());

    saveButton.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    closeButton.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(saveButton).toHaveFocus();
  });

  it('closes when pressing Escape', async () => {
    const onClose = vi.fn();

    render(
      <Modal open title="Exemplo" onClose={onClose}>
        <input placeholder="Nome" />
      </Modal>
    );

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
