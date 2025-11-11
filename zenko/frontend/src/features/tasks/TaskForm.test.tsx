import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import TaskForm from './TaskForm';
import type { Task } from './types';

const createTaskMock = vi.fn();
const updateTaskMock = vi.fn();
const deleteTaskMock = vi.fn();

vi.mock('./hooks', () => ({
  useTasks: () => ({
    createTask: createTaskMock,
    updateTask: updateTaskMock,
    deleteTask: deleteTaskMock
  })
}));

describe('TaskForm', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-10T12:00:00Z'));
    createTaskMock.mockResolvedValue(undefined);
    updateTaskMock.mockResolvedValue(undefined);
    deleteTaskMock.mockResolvedValue(undefined);
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

  it('blocks submission when due date is in the past', async () => {
    const onClose = vi.fn();
    render(<TaskForm onClose={onClose} />);

    const titleInput = getInputByLabelText('Título');
    fireEvent.change(titleInput, { target: { value: 'Nova tarefa' } });

    const dueDateInput = getInputByLabelText('Prazo');
    fireEvent.change(dueDateInput, { target: { value: '2024-01-09' } });

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Use uma data a partir de hoje')).toBeInTheDocument();
    expect(createTaskMock).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('submits with ISO due date when valid future date is provided', async () => {
    const onClose = vi.fn();
    render(<TaskForm onClose={onClose} />);

    const titleInput = getInputByLabelText('Título');
    fireEvent.change(titleInput, { target: { value: 'Planejar viagem' } });

    const dueDateInput = getInputByLabelText('Prazo');
    fireEvent.change(dueDateInput, { target: { value: '2024-01-12' } });

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(createTaskMock).toHaveBeenCalledTimes(1);
    });

    expect(createTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Planejar viagem',
        due_date: new Date('2024-01-12').toISOString()
      })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('sends null due date when the field is cleared for an existing task', async () => {
    const onClose = vi.fn();
    const task: Task = {
      id: 'task-1',
      user_id: 'user-1',
      title: 'Revisar relatório',
      description: 'Verificar números finais',
      status: 'doing',
      due_date: '2024-01-15T00:00:00.000Z',
      labels: ['financeiro'],
      checklist: [],
      attachments: [],
      created_at: '2024-01-01T10:00:00.000Z',
      updated_at: '2024-01-01T10:00:00.000Z'
    };

    render(<TaskForm task={task} onClose={onClose} />);

    const dueDateInput = getInputByLabelText('Prazo');
    fireEvent.change(dueDateInput, { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(updateTaskMock).toHaveBeenCalledTimes(1);
    });

    expect(updateTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-1',
        payload: expect.objectContaining({ due_date: null })
      })
    );
    expect(onClose).toHaveBeenCalled();
  });
});
