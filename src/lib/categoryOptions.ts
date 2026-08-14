type CategoryRow = { id: string; name: string; parent_id: string | null };
export type CategoryOption = { id: string; name: string };

// Flattens categories into a select-friendly list with brand sub-categories
// immediately following their parent, indented -- e.g. "Dash Cams", then
// "↳ QCY" and "↳ Lenovo" right after it.
export function buildCategoryOptions(categories: CategoryRow[]): CategoryOption[] {
  const topLevel = categories.filter((c) => !c.parent_id);
  const childrenByParent = new Map<string, CategoryRow[]>();
  for (const c of categories) {
    if (!c.parent_id) continue;
    const list = childrenByParent.get(c.parent_id) ?? [];
    list.push(c);
    childrenByParent.set(c.parent_id, list);
  }

  const options: CategoryOption[] = [];
  for (const parent of topLevel) {
    options.push({ id: parent.id, name: parent.name });
    for (const child of childrenByParent.get(parent.id) ?? []) {
      options.push({ id: child.id, name: `↳ ${child.name}` });
    }
  }
  return options;
}
