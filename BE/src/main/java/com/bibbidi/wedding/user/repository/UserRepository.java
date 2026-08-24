package com.bibbidi.wedding.user.repository;

import com.bibbidi.wedding.user.domain.User;
import java.util.Optional;

public interface UserRepository {

    boolean existsByNickname(String nickname);

    User save(User user);

    Optional<User> findByNickname(String nickname);
}
