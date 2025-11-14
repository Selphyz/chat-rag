import { Repository, FindOptionsWhere, FindManyOptions } from 'typeorm';

export class BaseRepository<T extends { id: string }> {
  constructor(private repository: Repository<T>) {}

  async findAll(options?: FindManyOptions<T>): Promise<T[]> {
    return this.repository.find(options);
  }

  async findOne(where: FindOptionsWhere<T>): Promise<T | null> {
    return this.repository.findOne({ where });
  }

  async findById(id: string): Promise<T | null> {
    return this.repository.findOneBy({ id } as any);
  }

  async create(entity: Partial<T>): Promise<T> {
    const newEntity = this.repository.create(entity as any);
    return (await this.repository.save(newEntity as any)) as unknown as T;
  }

  async update(id: string, entity: Partial<T>): Promise<T | null> {
    await this.repository.update(id, entity as any);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
