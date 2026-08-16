type CategoryRow = { id: string; name: string; parent_id: string | null };
export type CategoryOption = { id: string; name: string };

// Flattens categories into a select-friendly list with brand sub-categories
// immediately following their parent -- e.g. "Dash Cams", then
// "Dash Cams: QCY" and "Dash Cams: Lenovo" right after it, so the parent is
// legible without needing indentation (a plain <select> can't indent).
//
// A top-level category that has sub-categories is a pure grouping label
// (see the "Parent category" option on the category form) -- once it has
// at least one child, it's dropped from the selectable list itself so only
// its subs (or a childless, standalone top-level category like "GPS
// Navigation") can actually be assigned to an item.
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
    const children = childrenByParent.get(parent.id) ?? [];
    if (children.length === 0) {
      options.push({ id: parent.id, name: parent.name });
    }
    for (const child of children) {
      options.push({ id: child.id, name: `${parent.name}: ${child.name}` });
    }
  }
  return options;
}
