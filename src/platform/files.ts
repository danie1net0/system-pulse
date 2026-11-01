import Gio from 'gi://Gio';

export const readTextAsync = (path: string, cancellable: Gio.Cancellable): Promise<string> => {
    const file = Gio.File.new_for_path(path);

    return new Promise((resolve, reject) => {
        file.load_contents_async(cancellable, (_source, result) => {
            try {
                const [success, bytes] = file.load_contents_finish(result);

                if (!success) {
                    throw new Error(`Não foi possível ler ${path}`);
                }

                resolve(new TextDecoder().decode(bytes));
            } catch (error) {
                reject(error);
            }
        });
    });
};
