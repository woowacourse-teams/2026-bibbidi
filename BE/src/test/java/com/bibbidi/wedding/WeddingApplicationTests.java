package com.bibbidi.wedding;

import com.bibbidi.wedding.support.TestDatabaseLocks;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
@ResourceLock(TestDatabaseLocks.SPRING_TEST)
class WeddingApplicationTests {

	@Test
	void contextLoads() {
	}

}
