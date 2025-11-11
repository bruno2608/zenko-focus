import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TaskForm from '../TaskForm';
import { TaskPayload } from '../types';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

test('desabilita o botão enquanto aguarda salvar uma nova tarefa', async () => {
  const deferred = createDeferred<void>();

  function Wrapper() {
    const [isPending, setIsPending] = useState(false);

    const handleCreate = async (_payload: TaskPayload) => {
      setIsPending(true);
      await deferred.promise;
      setIsPending(false);
    };

    return (
      <TaskForm
        onClose={() => {}}
        createTask={handleCreate}
        updateTask={async () => {}}
        deleteTask={async () => {}}
        isCreatePending={isPending}
        isUpdatePending={false}
      />
    );
  }

  render(<Wrapper />);

  const [titleInput] = screen.getAllByRole('textbox');
  fireEvent.change(titleInput, { target: { value: 'Minha tarefa importante' } });

  const submitButton = screen.getByRole('button', { name: 'Salvar' });
  fireEvent.click(submitButton);

  await waitFor(() => expect(submitButton).toBeDisabled());
  expect(screen.getByText('Salvando...')).toBeInTheDocument();

  deferred.resolve();
  await waitFor(() => expect(submitButton).not.toBeDisabled());
});
