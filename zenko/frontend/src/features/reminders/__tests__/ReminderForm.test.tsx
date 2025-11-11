import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReminderForm from '../ReminderForm';
import { ReminderPayload } from '../types';

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

test('desabilita o botão enquanto aguarda salvar um lembrete', async () => {
  const deferred = createDeferred<void>();

  function Wrapper() {
    const [isPending, setIsPending] = useState(false);

    const handleCreate = async (_payload: ReminderPayload) => {
      setIsPending(true);
      await deferred.promise;
      setIsPending(false);
    };

    return (
      <ReminderForm
        onClose={() => {}}
        onCreate={handleCreate}
        onUpdate={async () => {}}
        onDelete={async () => {}}
        isCreatePending={isPending}
        isUpdatePending={false}
      />
    );
  }

  render(<Wrapper />);

  fireEvent.change(screen.getByLabelText(/Título/i), { target: { value: 'Lembrete' } });
  fireEvent.change(screen.getByLabelText(/Data e hora/i), { target: { value: '2025-01-01T10:00' } });

  const submitButton = screen.getByRole('button', { name: 'Salvar' });
  fireEvent.click(submitButton);

  await waitFor(() => expect(submitButton).toBeDisabled());
  expect(screen.getByText('Salvando...')).toBeInTheDocument();

  deferred.resolve();
  await waitFor(() => expect(submitButton).not.toBeDisabled());
});
