import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { listCategories, updateEmployeeCategory } from '@/features/companyAdmin/services/companyAdminApi';

interface Props {
  employeeId: number;
  currentCategoryId: number | null;
  disabled?: boolean;
}

/**
 * Select inline en la tabla de empleados. Cambia la categoría del empleado
 * al instante. Optimista visualmente — el cache se invalida en onSuccess.
 */
export function EmployeeCategorySelect({ employeeId, currentCategoryId, disabled }: Props) {
  const queryClient = useQueryClient();

  // Las categorías se cachean — todas las filas del tabla las comparten
  const { data: categories } = useQuery({
    queryKey: ['categoriesForCompanyAdmin'],
    queryFn: listCategories,
    staleTime: 5 * 60 * 1000, // 5 min — cambian rarísimo
  });

  const mutation = useMutation({
    mutationFn: (categoryId: number) => updateEmployeeCategory(employeeId, categoryId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companyEmployees'] }),
  });

  return (
    <Select
      value={currentCategoryId != null ? String(currentCategoryId) : ''}
      onValueChange={(v) => mutation.mutate(Number(v))}
      disabled={disabled || mutation.isPending}
    >
      <SelectTrigger className="h-7 px-2 text-[10px] uppercase tracking-brand font-medium w-auto min-w-[110px] bg-secondary border-secondary hover:bg-secondary/80">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        {categories?.map((c) => (
          <SelectItem key={c.id} value={String(c.id)}>
            {c.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
