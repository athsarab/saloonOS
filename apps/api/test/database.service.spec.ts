import { DatabaseService } from '../src/database/database.service';

describe('DatabaseService', () => {
  it('reports a successful database query', async () => {
    const service = new DatabaseService();
    const query = jest.spyOn(service, '$queryRaw').mockResolvedValue([{ result: 1 }]);

    await expect(service.checkConnection()).resolves.toBe(true);
    expect(query).toHaveBeenCalledTimes(1);
    await service.$disconnect();
  });
});
