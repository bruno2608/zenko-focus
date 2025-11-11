import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import ReminderForm from './ReminderForm';
import type { Reminder } from './types';

describe('ReminderForm', () => {
  const baseProps = {
    onClose: vi.fn(),
    onCreate: vi.fn(),
    onUpdate: vi.fn(),
    onDelete: vi.fn()
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-10T12:00:00Z'));
    baseProps.onClose.mockReset();
    baseProps.onCreate.mockReset();
    baseProps.onUpdate.mockReset();
    baseProps.onDelete.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  function getInputByLabelText(label: string) {
    const labelElement = screen.getByText(label);
    const container = labelElement.parentElement;
    if (!container) {
      throw new Error(`Label container not found for ${label}`);
    }
    const input = container.querySelector('input');
    if (!input) {
      throw new Error(`Input not found for label ${label}`);
    }
    return input as HTMLInputElement;
  }

  it('prevents submission when reminder datetime is in the past', async () => {
    render(<ReminderForm {...baseProps} />);

    const titleInput = getInputByLabelText('Título');
    fireEvent.change(titleInput, { target: { value: 'Consulta médica' } });

    const remindAtInput = getInputByLabelText('Data e hora');
    fireEvent.change(remindAtInput, { target: { value: '2024-01-10T10:00' } });

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Use uma data a partir de hoje')).toBeInTheDocument();
    expect(baseProps.onCreate).not.toHaveBeenCalled();
    expect(baseProps.onClose).not.toHaveBeenCalled();
  });

  it('submits when reminder datetime is in the future', async () => {
    render(<ReminderForm {...baseProps} />);

    const titleInput = getInputByLabelText('Título');
    fireEvent.change(titleInput, { target: { value: 'Enviar relatório' } });

    const remindAtInput = getInputByLabelText('Data e hora');
    fireEvent.change(remindAtInput, { target: { value: '2024-01-10T13:00' } });

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(baseProps.onCreate).toHaveBeenCalledTimes(1);
    });

    expect(baseProps.onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Enviar relatório',
        remind_at: new Date('2024-01-10T13:00').toISOString()
      })
    );
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('updates a reminder and preserves description when unchanged', async () => {
    const reminder: Reminder = {
      id: 'reminder-1',
      user_id: 'user-1',
      title: 'Reunião semanal',
      description: 'Trazer atualizações do projeto',
      remind_at: '2024-01-12T09:00:00.000Z',
      sent: false,
      created_at: '2024-01-01T00:00:00.000Z'
    };

    render(<ReminderForm {...baseProps} reminder={reminder} />);

    const remindAtInput = getInputByLabelText('Data e hora');
    fireEvent.change(remindAtInput, { target: { value: '2024-01-12T10:00' } });

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(baseProps.onUpdate).toHaveBeenCalledTimes(1);
    });

    expect(baseProps.onUpdate).toHaveBeenCalledWith({
      id: 'reminder-1',
      payload: expect.objectContaining({
        description: 'Trazer atualizações do projeto',
        remind_at: new Date('2024-01-12T10:00').toISOString()
      })
    });
    expect(baseProps.onClose).toHaveBeenCalled();
  });
});
