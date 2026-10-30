import Gio from 'gi://Gio';

export const readText = (path: string): string => {
    const [success, bytes] = Gio.File.new_for_path(path).load_contents(null);

    if (!success) {
        throw new Error(`Não foi possível ler ${path}`);
    }

    return new TextDecoder().decode(bytes);
};

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
