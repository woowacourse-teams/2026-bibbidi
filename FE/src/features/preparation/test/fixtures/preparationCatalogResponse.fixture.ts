export const preparationCatalogResponseFixture = {
  categories: [
    {
      displayOrder: 2,
      id: 20,
      name: "두 번째 카테고리",
      steps: [],
    },
    {
      displayOrder: 1,
      id: 10,
      name: "첫 번째 카테고리",
      steps: [
        {
          description: null,
          displayOrder: 1,
          iconUrl: null,
          id: 100,
          items: [
            {
              displayOrder: 2,
              essential: false,
              id: 1002,
              title: "두 번째 할 일",
            },
            {
              displayOrder: 1,
              essential: true,
              id: 1001,
              title: "첫 번째 할 일",
            },
          ],
          name: "준비 단계",
        },
      ],
    },
  ],
};
