import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import TaskForm from './TaskForm';
import type { Task } from './types';
import { useTasksStore } from './store';

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
    useTasksStore.setState((state) => ({
      filters: { ...state.filters, status: 'all', due: 'all', labels: [] },
      labelsLibrary: [],
      labelColorCursor: 0
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const baseProps = {
    createTask: createTaskMock,
    updateTask: updateTaskMock,
    deleteTask: deleteTaskMock,
    isCreatePending: false,
    isUpdatePending: false
  } as const;

  const baseProps = {
    createTask: createTaskMock,
    updateTask: updateTaskMock,
    deleteTask: deleteTaskMock,
    isCreatePending: false,
    isUpdatePending: false
  } as const;

  it('blocks submission when due date is in the past', async () => {
    const onClose = vi.fn();
    render(<TaskForm {...baseProps} onClose={onClose} />);

    const titleInput = screen.getByLabelText('Título');
    fireEvent.change(titleInput, { target: { value: 'Nova tarefa' } });

    const dueToggle = screen.getByRole('checkbox', { name: 'Data de entrega' });
    fireEvent.click(dueToggle);
    const dueDateInput = screen.getByLabelText('Data de entrega');
    fireEvent.change(dueDateInput, { target: { value: '2024-01-09' } });

    fireEvent.click(screen.getByRole('button', { name: 'Criar tarefa' }));

    expect(await screen.findByText('Use uma data a partir de hoje')).toBeInTheDocument();
    expect(createTaskMock).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('submits with formatted due date when valid future date is provided', async () => {
    const onClose = vi.fn();
    render(<TaskForm {...baseProps} onClose={onClose} />);

    const titleInput = screen.getByLabelText('Título');
    fireEvent.change(titleInput, { target: { value: 'Planejar viagem' } });

    const dueToggle = screen.getByRole('checkbox', { name: 'Data de entrega' });
    fireEvent.click(dueToggle);
    const dueDateInput = screen.getByLabelText('Data de entrega');
    fireEvent.change(dueDateInput, { target: { value: '2024-01-12' } });

    fireEvent.click(screen.getByRole('button', { name: 'Criar tarefa' }));

    await waitFor(() => {
      expect(createTaskMock).toHaveBeenCalledTimes(1);
    });

    expect(createTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Planejar viagem',
        due_date: '2024-01-12'
      })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('permite salvar uma tarefa com prazo para o dia atual', async () => {
    const onClose = vi.fn();
    render(<TaskForm {...baseProps} onClose={onClose} />);

    const titleInput = screen.getByLabelText('Título');
    fireEvent.change(titleInput, { target: { value: 'Enviar relatório' } });

    const dueToggle = screen.getByRole('checkbox', { name: 'Data de entrega' });
    fireEvent.click(dueToggle);
    const dueDateInput = screen.getByLabelText('Data de entrega');
    fireEvent.change(dueDateInput, { target: { value: '2024-01-10' } });

    fireEvent.click(screen.getByRole('button', { name: 'Criar tarefa' }));

    await waitFor(() => {
      expect(createTaskMock).toHaveBeenCalledTimes(1);
    });

    expect(createTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({ due_date: '2024-01-10' })
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

    render(<TaskForm {...baseProps} task={task} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));

    await waitFor(() => {
      expect(updateTaskMock).toHaveBeenCalledTimes(1);
    });

    expect(updateTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-1',
        payload: expect.objectContaining({ due_date: null })
      })
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
